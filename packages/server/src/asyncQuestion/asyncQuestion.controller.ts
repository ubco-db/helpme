import {
  CreateAsyncQuestions,
  ERROR_MESSAGES,
  Role,
  AsyncQuestionParams,
  asyncQuestionStatus,
  UpdateAsyncQuestions,
  MailServiceType,
  AsyncQuestionCommentParams,
  AsyncQuestion,
  nameToRGB,
  AsyncCreator,
} from '@koh/common';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
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
import { User, UserId } from '../decorators/user.decorator';
import { AsyncQuestionModel } from './asyncQuestion.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { Response } from 'express';
import { MailService } from 'mail/mail.service';
import { AsyncQuestionVotesModel } from './asyncQuestionVotes.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { AsyncQuestionCommentModel } from './asyncQuestionComment.entity';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { AsyncQuestionRolesGuard } from 'guards/async-question-roles.guard';
import { pick } from 'lodash';
import { UserModel } from 'profile/user.entity';
import { Not } from 'typeorm';
import { ApplicationConfigService } from 'config/application_config.service';

@Controller('asyncQuestions')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class asyncQuestionController {
  constructor(
    private readonly redisQueueService: RedisQueueService,
    private mailService: MailService,
    private readonly appConfig: ApplicationConfigService,
  ) {}

  @Post('vote/:qid/:vote')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async voteQuestion(
    @Param('qid', ParseIntPipe) qid: number,
    @Param('vote', ParseIntPipe) vote: number,
    @UserId() userId: number,
    @Res() res: Response,
  ): Promise<Response> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
    });

    if (!question) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.questionController.notFound });
      return;
    }

    let thisUserThisQuestionVote = await AsyncQuestionVotesModel.findOne({
      where: { userId, questionId: qid },
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
        thisUserThisQuestionVote.userId = userId;
        thisUserThisQuestionVote.question = question;
        thisUserThisQuestionVote.vote = newValue;
      }
    }

    await thisUserThisQuestionVote.save();

    const updatedQuestion = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
      ],
    });

    await this.redisQueueService.updateAsyncQuestion(
      `c:${updatedQuestion.courseId}:aq`,
      updatedQuestion,
    );

    // Check if the question was upvoted and send email if subscribed
    if (vote > 0 && userId !== updatedQuestion.creator.id) {
      const subscription = await UserSubscriptionModel.findOne({
        where: {
          userId: updatedQuestion.creator.id,
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
          receiver: updatedQuestion.creator.email,
          type: service.serviceType,
          subject: 'HelpMe - Your Anytime Question Has Been Upvoted',
          content: `<br> <b>Your question on the anytime question hub has received an upvote:</b> 
          <br> Question: ${updatedQuestion.questionText}
          <br> Current votes: ${updatedQuestion.votesSum}
          <br> <a href="${process.env.DOMAIN}/course/${updatedQuestion.courseId}/async_centre">View Here</a> <br>`,
        });
      }
    }

    return res.status(HttpStatus.OK).send({
      questionSumVotes: updatedQuestion.votesSum,
      vote: thisUserThisQuestionVote?.vote ?? 0,
    });
  }

  @Post(':cid')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR) // we let staff post questions too since they might want to use the system for demonstration purposes
  async createQuestion(
    @Body() body: CreateAsyncQuestions,
    @Param('cid', ParseIntPipe) cid: number,
    @UserId() userId: number,
    @Res() res: Response,
  ): Promise<any> {
    try {
      const question = await AsyncQuestionModel.create({
        courseId: cid,
        creatorId: userId,
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
        relations: [
          'creator',
          'taHelped',
          'votes',
          'comments',
          'comments.creator',
          'comments.creator.courses',
        ],
      });

      await this.redisQueueService.addAsyncQuestion(`c:${cid}:aq`, newQuestion);

      res.status(HttpStatus.CREATED).send(newQuestion);
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
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT)
  async updateStudentQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: UpdateAsyncQuestions,
    @UserId() userId: number,
  ): Promise<AsyncQuestionParams> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: questionId },
      relations: [
        'creator',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
      ],
    });

    if (!question) {
      throw new NotFoundException();
    }

    if (question.creatorId !== userId) {
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
      const courseId = question.courseId;

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
            <br>
            <br> Do NOT reply to this email. <a href="${process.env.DOMAIN}/course/${question.courseId}/async_centre">View and Answer It Here</a> <br>`,
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

    if (body.status === asyncQuestionStatus.StudentDeleted) {
      await this.redisQueueService.deleteAsyncQuestion(
        `c:${question.courseId}:aq`,
        updatedQuestion,
      );
    } else {
      await this.redisQueueService.updateAsyncQuestion(
        `c:${question.courseId}:aq`,
        updatedQuestion,
      );
    }
    delete question.taHelped;
    delete question.votes;

    return question;
  }

  @Patch('faculty/:questionId')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async updateTAQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: UpdateAsyncQuestions,
    @UserId() userId: number,
  ): Promise<AsyncQuestionParams> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: questionId },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
      ],
    });

    if (!question) {
      throw new NotFoundException();
    }

    const courseId = question.courseId;

    // Verify if user is TA/PROF of the course
    const requester = await UserCourseModel.findOne({
      where: {
        userId: userId,
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
      question.taHelpedId = userId;
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

      // TODO: add tests in asyncQuestion.integration to test to make sure it is sending the emails
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

  @Post('comment/:qid')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async postComment(
    @Param('qid', ParseIntPipe) qid: number,
    @Body() body: AsyncQuestionCommentParams,
    @User() user: UserModel,
    @Res() res: Response,
  ): Promise<Response> {
    const { commentText } = body;
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
    });

    if (!question) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.questionController.notFound });
      return;
    }

    const comment = await AsyncQuestionCommentModel.create({
      commentText,
      creator: user, // do NOT change this to userId since by putting user here it will pass the full creator when sending back the comment
      question,
      createdAt: new Date(),
    }).save();

    const updatedQuestion = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
      ],
    });

    await this.redisQueueService.updateAsyncQuestion(
      `c:${question.courseId}:aq`,
      updatedQuestion,
    );

    // TODO: Notify the creator of the question that a comment has been posted

    // only put necessary info for the response's creator (otherwise it would send the password hash and a bunch of other unnecessary info)
    comment.creator = {
      id: user.id,
      name: user.name,
      colour: nameToRGB(Math.abs(user.id - qid).toString()),
      anonId: getAnonId(user.id, qid),
      photoURL: user.photoURL,
    } as AsyncCreator as unknown as UserModel;

    res.status(HttpStatus.CREATED).send(comment);
  }

  @Patch('comment/:qid/:commentId')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async updateComment(
    @Param('qid', ParseIntPipe) qid: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() body: AsyncQuestionCommentParams,
    @UserId() userId: number,
    @Res() res: Response,
  ): Promise<Response> {
    const { commentText } = body;
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
    });

    if (!question) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.questionController.notFound });
      return;
    }

    const comment = await AsyncQuestionCommentModel.findOne({
      where: { id: commentId, questionId: qid },
    });

    if (!comment) {
      res.status(HttpStatus.NOT_FOUND).send({
        message:
          ERROR_MESSAGES.asyncQuestionController.comments.commentNotFound,
      });
      return;
    }

    if (comment.creatorId !== userId) {
      res.status(HttpStatus.FORBIDDEN).send({
        message:
          ERROR_MESSAGES.asyncQuestionController.comments.forbiddenUpdate,
      });
      return;
    }

    comment.commentText = commentText;
    await comment.save();

    const updatedQuestion = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
      ],
    });

    await this.redisQueueService.updateAsyncQuestion(
      `c:${question.courseId}:aq`,
      updatedQuestion,
    );

    res.status(HttpStatus.OK).send(comment);
  }

  @Delete('comment/:qid/:commentId')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async deleteComment(
    @Param('qid', ParseIntPipe) qid: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @UserId() userId: number,
    @Res() res: Response,
  ): Promise<Response> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
    });
    if (!question) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.questionController.notFound });
      return;
    }

    const userCourse = await UserCourseModel.findOne({
      where: {
        userId,
        courseId: question.courseId,
      },
    });
    if (!userCourse) {
      // shouldn't happen since AsyncQuestionRolesGuard should catch it
      throw new ForbiddenException('You are not in this course');
    }

    const comment = await AsyncQuestionCommentModel.findOne({
      where: { id: commentId, questionId: qid },
    });

    if (!comment) {
      res.status(HttpStatus.NOT_FOUND).send({
        message:
          ERROR_MESSAGES.asyncQuestionController.comments.commentNotFound,
      });
      return;
    }

    // staff can delete anyone's comments. students can only delete their own comments
    if (
      comment.creatorId !== userId &&
      userCourse.role !== Role.PROFESSOR &&
      userCourse.role !== Role.TA
    ) {
      res.status(HttpStatus.FORBIDDEN).send({
        message:
          ERROR_MESSAGES.asyncQuestionController.comments.forbiddenDelete,
      });
      return;
    }

    await comment.remove();

    const updatedQuestion = await AsyncQuestionModel.findOne({
      where: { id: qid },
      relations: [
        'creator',
        'taHelped',
        'votes',
        'comments',
        'comments.creator',
        'comments.creator.courses',
      ],
    });

    await this.redisQueueService.updateAsyncQuestion(
      `c:${question.courseId}:aq`,
      updatedQuestion,
    );

    res.status(HttpStatus.OK).send({ message: 'Comment deleted' });
  }

  @Get(':courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getAsyncQuestions(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UserId() userId: number,
    @Res() res: Response,
  ): Promise<AsyncQuestion[]> {
    const userCourse = await UserCourseModel.findOne({
      where: {
        userId,
        courseId,
      },
    });
    if (!userCourse) {
      throw new ForbiddenException('You are not in this course');
    }

    const asyncQuestionKeys = await this.redisQueueService.getKey(
      `c:${courseId}:aq`,
    );
    let all: AsyncQuestionModel[] = [];

    if (asyncQuestionKeys.length === 0) {
      console.log('Fetching from Database');
      all = await AsyncQuestionModel.find({
        where: {
          courseId,
          status: Not(asyncQuestionStatus.StudentDeleted),
        },
        relations: [
          'creator',
          'taHelped',
          'votes',
          'comments',
          'comments.creator',
          'comments.creator.courses',
        ],
        order: {
          createdAt: 'DESC',
        },
        take: this.appConfig.get('max_async_questions_per_course'),
      });

      if (all)
        await this.redisQueueService.setAsyncQuestions(`c:${courseId}:aq`, all);
    } else {
      console.log('Fetching from Redis');
      all = Object.values(asyncQuestionKeys).map(
        (question) => question as AsyncQuestionModel,
      );
    }

    if (!all) {
      throw new NotFoundException('No questions found');
    }

    let questions;

    const isStaff: boolean =
      userCourse.role === Role.TA || userCourse.role === Role.PROFESSOR;

    if (isStaff) {
      // Staff sees all questions except the ones deleted
      questions = all.filter(
        (question) => question.status !== asyncQuestionStatus.TADeleted,
      );
    } else {
      // Students see their own questions and questions that are visible
      questions = all.filter(
        (question) => question.creatorId === userId || question.visible,
      );
    }

    questions = questions.map((question: AsyncQuestionModel) => {
      const temp = pick(question, [
        'id',
        'courseId',
        'questionAbstract',
        'questionText',
        'aiAnswerText',
        'answerText',
        'creatorId',
        'taHelpedId',
        'createdAt',
        'closedAt',
        'status',
        'visible',
        'verified',
        'votes',
        'comments',
        'questionTypes',
        'votesSum',
        'isTaskQuestion',
      ]);

      const filteredComments = question.comments?.map((comment) => {
        const temp = { ...comment };
        // TODO: maybe find a more performant way of doing this (ideally in the query, and maybe try to include a SELECT to eliminate the pick() above)
        const commenterRole =
          comment.creator.courses.find(
            (course) => course.courseId === question.courseId,
          )?.role || Role.STUDENT;

        temp.creator =
          isStaff ||
          comment.creator.id === userId ||
          commenterRole !== Role.STUDENT
            ? ({
                id: comment.creator.id,
                anonId: getAnonId(comment.creator.id, question.id),
                colour: nameToRGB(
                  Math.abs(comment.creatorId - question.id).toString(),
                ),
                name: comment.creator.name,
                photoURL: comment.creator.photoURL,
                isAuthor: comment.creator.id === question.creatorId,
                courseRole: commenterRole,
                // this is an AsyncCreator but I'm casting it to UserModel so typescript doesn't get mad
              } as AsyncCreator as unknown as UserModel)
            : ({
                // don't send user name, pfp, nor userid to frontend
                anonId: getAnonId(comment.creator.id, question.id),
                colour: nameToRGB(
                  Math.abs(comment.creatorId - question.id).toString(),
                ),
                photoURL: null,
                isAuthor: comment.creator.id === question.creatorId,
                courseRole: commenterRole,
              } as AsyncCreator as unknown as UserModel);

        return temp as unknown as AsyncQuestionCommentModel;
      });
      temp.comments = filteredComments;

      Object.assign(temp, {
        creator:
          isStaff || question.creator.id == userId
            ? {
                id: question.creator.id,
                anonId: getAnonId(question.creator.id, question.id),
                colour: nameToRGB(
                  Math.abs(question.creator.id - question.id).toString(),
                ),
                name: question.creator.name,
                photoURL: question.creator.photoURL,
              }
            : {
                anonId: getAnonId(question.creator.id, question.id),
                colour: nameToRGB(
                  Math.abs(question.creator.id - question.id).toString(),
                ),
                name: 'Anonymous',
                photoURL: null,
              },
      });

      return temp;
    });

    res.status(HttpStatus.OK).send(questions);
    return;
  }
}

/**
 * Takes in a userId and async questionId and hashes them to return a random index from ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES
 * Note that 70 is the length of ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES
 * I have opted to hard-code it since I don't want to put that giant array here and it's unlikely to change
 */
function getAnonId(userId: number, questionId: number) {
  const hash = userId + questionId;
  return hash % 70;
}
