import {
  CreateAsyncQuestions,
  ERROR_MESSAGES,
  Role,
  AsyncQuestionParams,
  asyncQuestionStatus,
  UpdateAsyncQuestions,
  OrganizationRole,
  MailServiceType,
} from '@koh/common';
import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { User } from '../decorators/user.decorator';
import { UserModel } from '../profile/user.entity';
import { AsyncQuestionModel } from './asyncQuestion.entity';
import { CourseModel } from '../course/course.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { Response } from 'express';
import { MailService } from 'mail/mail.service';
import { AsyncQuestionVotesModel } from './asyncQuestionVotes.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { MailServiceModel } from 'mail/mail-services.entity';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';

@Controller('asyncQuestions')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class asyncQuestionController {
  constructor(
    private readonly redisQueueService: RedisQueueService,
    private mailService: MailService,
  ) {}

  @Post(':qid/:vote')
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async voteQuestion(
    @Param('qid') qid: number,
    @Param('vote') vote: number,
    @User() user: UserModel,
    @Res() res: Response,
  ): Promise<Response> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: ['course'],
    });

    if (!question) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.questionController.notFound });
      return;
    }

    let thisUserThisQuestionVote = await AsyncQuestionVotesModel.findOne({
      where: { userId: user.id, questionId: qid },
    });

    const hasVoted = thisUserThisQuestionVote !== undefined;
    const sumVotes = thisUserThisQuestionVote?.vote ?? 0;

    const newValue = sumVotes + vote;

    const canVote = newValue <= 1 && newValue >= -1;
    if (canVote) {
      if (hasVoted) {
        thisUserThisQuestionVote.vote = newValue;
      } else {
        thisUserThisQuestionVote = new AsyncQuestionVotesModel();
        thisUserThisQuestionVote.user = user;
        thisUserThisQuestionVote.question = question;
        thisUserThisQuestionVote.vote = newValue;
      }
    }

    await thisUserThisQuestionVote.save();

    const updatedQuestion = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: ['creator', 'taHelped', 'votes'],
    });

    await this.redisQueueService.updateAsyncQuestion(
      `c:${question.course.id}:aq`,
      updatedQuestion,
    );

    return res.status(HttpStatus.OK).send({
      questionSumVotes: updatedQuestion.votesSum,
      vote: thisUserThisQuestionVote?.vote ?? 0,
    });
  }

  @Post(':cid')
  @Roles(Role.STUDENT)
  async createQuestion(
    @Body() body: CreateAsyncQuestions,
    @Param('cid') cid: number,
    @User() user: UserModel,
    @Res() res: Response,
  ): Promise<any> {
    const c = await CourseModel.findOne({
      where: { id: cid },
    });

    if (!c) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.questionController.notFound });
      return;
    }
    try {
      const question = await AsyncQuestionModel.create({
        courseId: cid,
        creator: user,
        creatorId: user.id,
        course: c,
        questionAbstract: body.questionAbstract,
        questionText: body.questionText || null,
        answerText: body.answerText || null,
        aiAnswerText: body.aiAnswerText,
        questionTypes: body.questionTypes,
        status: body.status || asyncQuestionStatus.AIAnswered,
        visible: false,
        verified: false,
        createdAt: new Date(),
      }).save();

      const newQuestion = await AsyncQuestionModel.findOne({
        where: {
          courseId: cid,
          id: question.id,
        },
        relations: ['creator', 'taHelped', 'votes'],
      });

      await this.redisQueueService.addAsyncQuestion(`c:${cid}:aq`, newQuestion);

      res.status(HttpStatus.CREATED).send(question);
      return;
    } catch (err) {
      console.error(err);
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ message: ERROR_MESSAGES.questionController.saveQError });
      return;
    }
  }

  @Patch('student/:questionId')
  /**
   * Updates a student's async question.
   *
   * @param {number} questionId - The ID of the question to update.
   * @param {UpdateAsyncQuestions} body - The updated question data.
   * @param {UserModel} user - The user making the request.
   * @return {Promise<AsyncQuestionParams>} The updated question.
   * @throws {NotFoundException} If the question is not found.
   * @throws {HttpException} If the user is not the creator of the question.
   * @throws {HttpException} If the user tries to update the question's status to TADeleted or HumanAnswered.
   */
  async updateStudentQuestion(
    @Param('questionId') questionId: number,
    @Body() body: UpdateAsyncQuestions,
    @User() user: UserModel,
  ): Promise<AsyncQuestionParams> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: questionId },
      relations: ['course', 'creator', 'votes'],
    });

    if (!question) {
      throw new NotFoundException();
    }

    if (question.creatorId !== user.id) {
      throw new HttpException(
        'You can only update your own questions',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (body.status === asyncQuestionStatus.AIAnsweredNeedsAttention) {
      const courseId = question.course.id;

      // Step 1: Get all users in the course
      const usersInCourse = await UserCourseModel.createQueryBuilder(
        'userCourse',
      )
        .select('userCourse.userId')
        .where('userCourse.courseId = :courseId', { courseId })
        .getMany();

      const userIds = usersInCourse.map((uc) => uc.userId);

      // Step 2: Get subscriptions for these users
      const subscriptions = await UserSubscriptionModel.createQueryBuilder(
        'subscription',
      )
        .innerJoinAndSelect('subscription.user', 'user')
        .innerJoinAndSelect('subscription.service', 'service')
        .where('subscription.userId IN (:...userIds)', { userIds })
        .andWhere('service.serviceType = :serviceType', {
          serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
        })
        .andWhere('subscription.isSubscribed = true')
        .getMany();

      // Send emails in parallel
      await Promise.all(
        subscriptions.map((sub) =>
          this.mailService.sendEmail({
            receiver: sub.user.email,
            type: MailServiceType.ASYNC_QUESTION_FLAGGED,
            subject: 'HelpMe - New Question Marked as Needing Attention',
            content: `<br> <b>A new question has been posted on the anytime question hub and has been marked as needing attention:</b> 
            <br> <b>Question Abstract:</b> ${question.questionAbstract}
            <br> <b>Question Types:</b> ${question.questionTypes.map((qt) => qt.name).join(', ')}
            <br> <b>Question Text:</b> ${question.questionText}
            <br> <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View and Answer It Here</a> <br>`,
          }),
        ),
      );
    }

    // Update allowed fields
    Object.keys(body).forEach((key) => {
      if (body[key] !== undefined && body[key] !== null) {
        question[key] = body[key];
      }
    });

    const updatedQuestion = await question.save();

    // Update Redis queue
    await this.redisQueueService.updateAsyncQuestion(
      `c:${question.course.id}:aq`,
      updatedQuestion,
    );

    if (body.status === asyncQuestionStatus.StudentDeleted) {
      await this.redisQueueService.deleteAsyncQuestion(
        `c:${question.course.id}:aq`,
        updatedQuestion,
      );
    } else {
      await this.redisQueueService.updateAsyncQuestion(
        `c:${question.course.id}:aq`,
        updatedQuestion,
      );
    }
    delete question.taHelped;
    delete question.votes;

    return question;
  }

  @Patch('faculty/:questionId')
  async updateTAQuestion(
    @Param('questionId') questionId: number,
    @Body() body: UpdateAsyncQuestions,
    @User() user: UserModel,
  ): Promise<AsyncQuestionParams> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: questionId },
      relations: ['course', 'creator', 'taHelped', 'votes'],
    });

    if (!question) {
      throw new NotFoundException();
    }

    const courseId = question.course.id;

    // Verify if user is TA/PROF of the course
    const requester = await UserCourseModel.findOne({
      where: {
        userId: user.id,
        courseId: courseId,
      },
    });

    if (!requester || requester.role === Role.STUDENT) {
      throw new HttpException(
        'You must be a TA/PROF to update this question',
        HttpStatus.UNAUTHORIZED,
      );
    }

    Object.keys(body).forEach((key) => {
      if (body[key] !== undefined && body[key] !== null) {
        question[key] = body[key];
      }
    });

    if (
      body.status === asyncQuestionStatus.HumanAnswered ||
      body.status === asyncQuestionStatus.AIAnsweredResolved
    ) {
      question.closedAt = new Date();
      question.taHelpedId = user.id;
      const subscription = await UserSubscriptionModel.findOne({
        where: {
          user: { id: question.creator.id },
          service: { name: 'async_question_human_answered' },
        },
        relations: ['service'],
      });

      if (subscription) {
        const service = subscription.service;
        await this.mailService.sendEmail({
          receiver: question.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Has Been Answered',
          content: `<br> <b>Your question on the anytime question hub has been answered or verified by staff:</b> 
          <br> ${question.answerText}
          <br> <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View Here</a> <br>`,
        });
      }
    }

    const updatedQuestion = await question.save();

    if (
      body.status === asyncQuestionStatus.TADeleted ||
      body.status === asyncQuestionStatus.StudentDeleted
    ) {
      await this.redisQueueService.deleteAsyncQuestion(
        `c:${courseId}:aq`,
        updatedQuestion,
      );
    } else {
      await this.redisQueueService.updateAsyncQuestion(
        `c:${courseId}:aq`,
        updatedQuestion,
      );
    }

    delete question.taHelped;
    delete question.votes;

    return question;
  }
}
