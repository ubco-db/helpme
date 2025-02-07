import {
  CreateAsyncQuestions,
  ERROR_MESSAGES,
  Role,
  AsyncQuestionParams,
  asyncQuestionStatus,
  UpdateAsyncQuestions,
  MailServiceType,
} from '@koh/common';
import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
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
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { UnreadAsyncQuestionModel } from './unread-async-question.entity';
import { createQueryBuilder, getRepository } from 'typeorm';

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
    @Param('qid', ParseIntPipe) qid: number,
    @Param('vote', ParseIntPipe) vote: number,
    @User() user: UserModel,
    @Res() res: Response,
  ): Promise<Response> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: ['course', 'creator'],
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

    // Check if the question was upvoted and send email if subscribed
    if (vote > 0 && user.id !== question.creator.id) {
      const subscription = await UserSubscriptionModel.findOne({
        where: {
          userId: question.creator.id,
          isSubscribed: true,
          service: {
            serviceType: MailServiceType.ASYNC_QUESTION_UPVOTED,
          },
        },
        relations: ['service'],
      });

      if (subscription) {
        const service = subscription.service;
        await this.mailService.sendEmail({
          receiver: question.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Has Been Upvoted',
          content: `<br> <b>Your question on the anytime question hub has received an upvote:</b>
          <br> Question: ${question.questionText}
          <br> Current votes: ${updatedQuestion.votesSum}
          <br> <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View Here</a> <br>`,
        });
      }
    }

    return res.status(HttpStatus.OK).send({
      questionSumVotes: updatedQuestion.votesSum,
      vote: thisUserThisQuestionVote?.vote ?? 0,
    });
  }

  @Post(':cid')
  @Roles(Role.STUDENT)
  async createQuestion(
    @Body() body: CreateAsyncQuestions,
    @Param('cid', ParseIntPipe) cid: number,
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
        relations: ['creator', 'taHelped', 'votes', 'viewers'],
      });

      await this.redisQueueService.addAsyncQuestion(`c:${cid}:aq`, newQuestion);

      const usersInCourse = await UserCourseModel.find({
        where: { courseId: cid },
      });

      if (usersInCourse?.length) {
        await getRepository(UnreadAsyncQuestionModel)
          .createQueryBuilder()
          .insert()
          .into(UnreadAsyncQuestionModel)
          .values(
            usersInCourse.map((userCourse) => ({
              userId: userCourse.userId,
              courseId: cid,
              asyncQuestion: question,
              readLatest:
                userCourse.userId === user.id ||
                userCourse.role === Role.STUDENT, // if you're the creator or a student, don't mark as unread because not yet visible
            })),
          )
          .execute();
      }
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
  async updateStudentQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: UpdateAsyncQuestions,
    @User() user: UserModel,
  ): Promise<AsyncQuestionParams> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: questionId },
      relations: ['course', 'creator', 'votes'],
    });
    // deep copy question since it changes
    const oldQuestion: AsyncQuestionModel = JSON.parse(
      JSON.stringify(question),
    );

    if (!question) {
      throw new NotFoundException();
    }

    if (question.creatorId !== user.id) {
      throw new HttpException(
        'You can only update your own questions',
        HttpStatus.UNAUTHORIZED,
      );
    }
    // if you created the question (i.e. a student), you can't update the status to illegal ones
    if (
      body.status === asyncQuestionStatus.TADeleted ||
      body.status === asyncQuestionStatus.HumanAnswered
    ) {
      throw new HttpException(
        `You cannot update your own question's status to ${body.status}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (
      body.status === asyncQuestionStatus.AIAnsweredNeedsAttention &&
      question.status != asyncQuestionStatus.AIAnsweredNeedsAttention
    ) {
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

    // Mark as new unread for all staff if the question needs attention
    if (
      body.status === asyncQuestionStatus.AIAnsweredNeedsAttention &&
      oldQuestion.status !== asyncQuestionStatus.AIAnsweredNeedsAttention
    ) {
      await createQueryBuilder(UnreadAsyncQuestionModel)
        .update(UnreadAsyncQuestionModel)
        .set({ readLatest: false })
        .where('asyncQuestionId = :asyncQuestionId', {
          asyncQuestionId: questionId,
        })
        .andWhere('userId != :userId', { userId: user.id }) // don't notify me (question creator)
        // Use a subquery to filter by roles
        .andWhere(
          `"userId" IN (
       SELECT "user_course_model"."userId"
       FROM "user_course_model"
       WHERE "user_course_model"."role" IN (:...roles)
     )`, // notify all staff
          { roles: [Role.PROFESSOR, Role.TA] },
        )
        .execute();
    }
    // if the question is visible and they rewrote their question and got a new answer text, mark it as unread for everyone
    if (
      updatedQuestion.visible &&
      body.aiAnswerText !== oldQuestion.aiAnswerText &&
      body.questionText !== oldQuestion.questionText
    ) {
      await getRepository(UnreadAsyncQuestionModel)
        .createQueryBuilder()
        .update(UnreadAsyncQuestionModel)
        .set({ readLatest: false })
        .where('asyncQuestionId = :asyncQuestionId', {
          asyncQuestionId: questionId,
        })
        .andWhere(
          `userId != :userId`,
          { userId: user.id }, // don't notify me (question creator)
        )
        .execute();
    }

    if (body.status === asyncQuestionStatus.StudentDeleted) {
      await this.redisQueueService.deleteAsyncQuestion(
        `c:${question.course.id}:aq`,
        updatedQuestion,
      );
      // delete all unread notifications for this question
      await UnreadAsyncQuestionModel.delete({ asyncQuestionId: questionId });
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

  // check that verified equals true and something changed
  @Patch('faculty/:questionId')
  async updateTAQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: UpdateAsyncQuestions,
    @User() user: UserModel,
  ): Promise<AsyncQuestionParams> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: questionId },
      relations: ['course', 'creator', 'taHelped', 'votes'],
    });
    // deep copy question since it changes
    const oldQuestion: AsyncQuestionModel = JSON.parse(
      JSON.stringify(question),
    );

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

    if (body.status === asyncQuestionStatus.HumanAnswered) {
      question.closedAt = new Date();
      question.taHelpedId = user.id;
      const subscription = await UserSubscriptionModel.findOne({
        where: {
          userId: question.creator.id,
          isSubscribed: true,
          service: {
            serviceType: MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
          },
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
    } else {
      //send generic your async question changed.
      const statusChangeSubscription = await UserSubscriptionModel.findOne({
        where: {
          userId: question.creator.id,
          isSubscribed: true,
          service: {
            serviceType: MailServiceType.ASYNC_QUESTION_STATUS_CHANGED,
          },
        },
        relations: ['service'],
      });

      if (statusChangeSubscription) {
        const service = statusChangeSubscription.service;
        await this.mailService.sendEmail({
          receiver: question.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Status Has Changed',
          content: `<br> <b>The status of your question on the anytime question hub has been updated:</b>
          <br> New status: ${body.status}
          <br> <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View Here</a> <br>`,
        });
      }
    }

    const updatedQuestion = await question.save();

    // Mark as new unread for all students if the question is marked as visible
    if (body.visible && !oldQuestion.visible) {
      await createQueryBuilder(UnreadAsyncQuestionModel)
        .update(UnreadAsyncQuestionModel)
        .set({ readLatest: false })
        .where('asyncQuestionId = :asyncQuestionId', {
          asyncQuestionId: questionId,
        })
        .andWhere('userId != :userId', { userId: user.id }) // don't notify me (staff who is making update)
        // Use a subquery to filter by roles
        .andWhere(
          `"userId" IN (
     SELECT "user_course_model"."userId"
     FROM "user_course_model"
     WHERE "user_course_model"."role" IN (:...roles)
   )`, // notify all students
          { roles: [Role.STUDENT] },
        )
        .execute();
    }
    // When the question creator gets their question human verified, notify them
    if (
      oldQuestion.status !== asyncQuestionStatus.HumanAnswered &&
      !oldQuestion.verified &&
      (body.status === asyncQuestionStatus.HumanAnswered ||
        body.verified === true)
    ) {
      await createQueryBuilder(UnreadAsyncQuestionModel)
        .update(UnreadAsyncQuestionModel)
        .set({ readLatest: false })
        .where('asyncQuestionId = :asyncQuestionId', {
          asyncQuestionId: questionId,
        })
        .andWhere(
          `userId = :userId`,
          { userId: updatedQuestion.creatorId }, // notify ONLY question creator
        )
        .execute();
    }

    if (
      body.status === asyncQuestionStatus.TADeleted ||
      body.status === asyncQuestionStatus.StudentDeleted
    ) {
      await this.redisQueueService.deleteAsyncQuestion(
        `c:${courseId}:aq`,
        updatedQuestion,
      );
      // delete all unread notifications for this question
      await UnreadAsyncQuestionModel.delete({ asyncQuestionId: questionId });
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
