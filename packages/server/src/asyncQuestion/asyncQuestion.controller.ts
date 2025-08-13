import {
  AsyncCreator,
  AsyncQuestion,
  AsyncQuestionCommentParams,
  AsyncQuestionParams,
  asyncQuestionStatus,
  CreateAsyncQuestions,
  ERROR_MESSAGES,
  nameToRGB,
  Role,
  UnreadAsyncQuestionResponse,
  UpdateAsyncQuestions,
} from '@koh/common';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
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
import { AsyncQuestionVotesModel } from './asyncQuestionVotes.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { AsyncQuestionCommentModel } from './asyncQuestionComment.entity';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { AsyncQuestionRolesGuard } from 'guards/async-question-roles.guard';
import { pick } from 'lodash';
import { UserModel } from 'profile/user.entity';
import { Not } from 'typeorm';
import { ApplicationConfigService } from '../config/application_config.service';
import { AsyncQuestionService } from './asyncQuestion.service';
import { UnreadAsyncQuestionModel } from './unread-async-question.entity';
import { CourseSettingsModel } from '../course/course_settings.entity';
import { CourseRole } from '../decorators/course-role.decorator';

@Controller('asyncQuestions')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class asyncQuestionController {
  constructor(
    private readonly redisQueueService: RedisQueueService,
    private readonly appConfig: ApplicationConfigService,
    private readonly asyncQuestionService: AsyncQuestionService,
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
      where: { userId: userId, questionId: qid },
    });

    const hasVoted = thisUserThisQuestionVote !== null;
    const sumVotes = thisUserThisQuestionVote?.vote ?? 0;

    const newValue = sumVotes + vote;

    const canVote = newValue === 0 || newValue === 1 || newValue === -1;
    if (!canVote) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Invalid Vote (the new value must be 0, 1, or -1)' });
      return;
    }
    if (hasVoted) {
      thisUserThisQuestionVote.vote = newValue;
    } else {
      thisUserThisQuestionVote = new AsyncQuestionVotesModel();
      thisUserThisQuestionVote.userId = userId;
      thisUserThisQuestionVote.question = question;
      thisUserThisQuestionVote.vote = newValue;
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
    if (newValue === 1 && userId !== updatedQuestion.creator.id) {
      await this.asyncQuestionService.sendUpvotedEmail(updatedQuestion);
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
    @CourseRole() courseRole: Role,
    @Res() res: Response,
  ): Promise<any> {
    try {
      const courseSettings = await CourseSettingsModel.findOne({
        where: { courseId: cid },
      });

      const question = await AsyncQuestionModel.create({
        courseId: cid,
        creatorId: userId,
        questionAbstract: body.questionAbstract,
        questionText: body.questionText || null,
        answerText: body.answerText || null,
        aiAnswerText: body.aiAnswerText,
        questionTypes: body.questionTypes,
        status: body.status || asyncQuestionStatus.AIAnswered,
        staffSetVisible: null,
        authorSetVisible:
          ((courseSettings?.asyncCentreAuthorPublic ?? false) &&
            body.authorSetVisible) ||
          false,
        isAnonymous:
          body.isAnonymous ??
          courseSettings?.asyncCentreDefaultAnonymous ??
          true,
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
      await this.asyncQuestionService.createUnreadNotificationsForQuestion(
        newQuestion,
      );

      if (body.status === asyncQuestionStatus.AIAnsweredNeedsAttention) {
        await this.asyncQuestionService.sendNeedsAttentionEmail(question);
      }

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
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR) // since were letting staff post questions, they might end up calling this endpoint to update their own questions
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

    const courseSettings = await CourseSettingsModel.findOne({
      where: { courseId: question.courseId },
    });

    // deep copy question since it changes
    const oldQuestion: AsyncQuestionModel = JSON.parse(
      JSON.stringify(question),
    );

    if (!question) {
      throw new NotFoundException('Question Not Found');
    }

    if (question.creatorId !== userId) {
      throw new ForbiddenException('You can only update your own questions');
    }
    // if you created the question (i.e. a student), you can't update the status to illegal ones
    if (
      body.status === asyncQuestionStatus.TADeleted ||
      body.status === asyncQuestionStatus.HumanAnswered
    ) {
      throw new ForbiddenException(
        `You cannot update your own question's status to ${body.status}`,
      );
    }
    if (
      body.status === asyncQuestionStatus.AIAnsweredNeedsAttention &&
      question.status != asyncQuestionStatus.AIAnsweredNeedsAttention
    ) {
      await this.asyncQuestionService.sendNeedsAttentionEmail(question);
    }

    // Update allowed fields
    Object.keys(body).forEach((key) => {
      if (
        key == 'authorSetVisible' &&
        !(courseSettings?.asyncCentreAuthorPublic ?? false)
      ) {
        body[key] = false;
      }
      if (body[key] !== undefined && body[key] !== null) {
        question[key] = body[key];
      }
    });

    const updatedQuestion = await question.save();

    // If anonymity setting changed, update anonymity of any comments by the author
    if (oldQuestion.isAnonymous != updatedQuestion.isAnonymous) {
      const authorComments = updatedQuestion.comments.filter(
        (c) => c.creatorId == userId,
      );
      for (const comment of authorComments) {
        comment.isAnonymous = updatedQuestion.isAnonymous;
        await comment.save();
      }
    }

    // Mark as new unread for all staff if the question needs attention
    if (
      body.status === asyncQuestionStatus.AIAnsweredNeedsAttention &&
      oldQuestion.status !== asyncQuestionStatus.AIAnsweredNeedsAttention
    ) {
      await this.asyncQuestionService.markUnreadForRoles(
        updatedQuestion,
        [Role.TA, Role.PROFESSOR],
        userId,
      );
    }
    // if the question is visible and they rewrote their question and got a new answer text, mark it as unread for everyone
    if (
      (await this.asyncQuestionService.isVisible(updatedQuestion)) &&
      body.aiAnswerText !== oldQuestion.aiAnswerText &&
      body.questionText !== oldQuestion.questionText
    ) {
      await this.asyncQuestionService.markUnreadForAll(updatedQuestion, userId);
    }

    if (body.status === asyncQuestionStatus.StudentDeleted) {
      await this.redisQueueService.deleteAsyncQuestion(
        `c:${question.courseId}:aq`,
        updatedQuestion,
      );
      // delete all unread notifications for this question
      await UnreadAsyncQuestionModel.delete({ asyncQuestionId: questionId });
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

  // check that verified equals true and something changed
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

    // deep copy question since it changes
    const oldQuestion: AsyncQuestionModel = JSON.parse(
      JSON.stringify(question),
    );

    if (!question) {
      throw new NotFoundException('Question Not Found');
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
      throw new ForbiddenException(
        'You must be a TA/PROF to update this question',
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
      await this.asyncQuestionService.sendQuestionAnsweredEmails(question);
    } else if (
      body.status !== asyncQuestionStatus.TADeleted &&
      body.status !== asyncQuestionStatus.StudentDeleted
    ) {
      // don't send status change email if its deleted
      // (I don't like the vibes of notifying a student that their question was deleted by staff)
      // Though technically speaking this isn't even really used yet since there isn't a status that the TA would really turn it to that isn't HumanAnswered or TADeleted
      await this.asyncQuestionService.sendGenericStatusChangeEmail(
        question,
        body.status,
      );
    }

    const updatedQuestion = await question.save();

    // Mark as new unread for all students if the question is marked as visible
    const courseSettings = await CourseSettingsModel.findOne({
      where: { courseId: courseId },
    });
    const oldVisible = await this.asyncQuestionService.isVisible(
      oldQuestion,
      courseSettings,
    );
    const newVisible = await this.asyncQuestionService.isVisible(
      updatedQuestion,
      courseSettings,
    );
    if (newVisible && !oldVisible) {
      await this.asyncQuestionService.markUnreadForRoles(
        updatedQuestion,
        [Role.STUDENT],
        userId,
      );
    }
    // When the question creator gets their question human verified, notify them
    if (
      oldQuestion.status !== asyncQuestionStatus.HumanAnswered &&
      !oldQuestion.verified &&
      (body.status === asyncQuestionStatus.HumanAnswered ||
        body.verified === true)
    ) {
      await this.asyncQuestionService.markUnreadForCreator(updatedQuestion);
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

  @Post('comment/:qid')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async postComment(
    @Param('qid', ParseIntPipe) qid: number,
    @Body() body: AsyncQuestionCommentParams,
    @User() user: UserModel,
    @CourseRole() courseRole: Role,
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

    const courseSettings = await CourseSettingsModel.findOne({
      where: { courseId: question.courseId },
    });

    const isStaff = courseRole == Role.TA || courseRole == Role.PROFESSOR;
    const isAuthor = user.id == question.creatorId;
    const comment = await AsyncQuestionCommentModel.create({
      commentText: body.commentText,
      creator: user, // do NOT change this to userId since by putting user here it will pass the full creator when sending back the comment
      question,
      isAnonymous:
        isStaff && !isAuthor
          ? false
          : isAuthor
            ? question.isAnonymous
            : (body.isAnonymous ??
              courseSettings?.asyncCentreDefaultAnonymous ??
              true),
      createdAt: new Date(),
    }).save();

    const otherComments = await AsyncQuestionCommentModel.find({
      where: {
        creatorId: user.id,
        questionId: qid,
        id: Not(comment.id),
      },
    });
    const originalAnons = otherComments.map((c) => c.isAnonymous);
    otherComments.forEach((oc) => (oc.isAnonymous = comment.isAnonymous));
    await AsyncQuestionCommentModel.save(
      otherComments.filter((v, i) => originalAnons[i] != v.isAnonymous),
    );

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

    // don't send email if its a comment on your own post
    if (question.creatorId !== user.id) {
      await this.asyncQuestionService.sendNewCommentOnMyQuestionEmail(
        user,
        courseRole,
        updatedQuestion,
        comment,
      );
    }
    // send emails out to all users that have posted a comment on this question (it also performs checks)
    await this.asyncQuestionService.sendNewCommentOnOtherQuestionEmail(
      user,
      courseRole,
      question.creatorId,
      updatedQuestion,
      comment,
    );

    // new comment: if visible, mark question as unread for everyone (except the creator of the comment)
    if (
      await this.asyncQuestionService.isVisible(updatedQuestion, courseSettings)
    ) {
      await this.asyncQuestionService.markUnreadForAll(
        updatedQuestion,
        user.id,
      );
    } else if (courseRole === Role.TA || courseRole === Role.PROFESSOR) {
      // if the question is not visible, and poster is staff, mark it as unread for the creator
      await this.asyncQuestionService.markUnreadForCreator(updatedQuestion);
    } else if (courseRole === Role.STUDENT) {
      // if the question is not visible, and poster is student, mark it as unread for staff
      await this.asyncQuestionService.markUnreadForRoles(
        updatedQuestion,
        [Role.TA, Role.PROFESSOR],
        user.id,
      );
    }

    // only put necessary info for the response's creator (otherwise it would send the password hash and a bunch of other unnecessary info)
    const comments = [comment, ...otherComments];
    for (const c of comments) {
      c.creator = {
        id: user.id,
        name: user.name,
        colour: nameToRGB(Math.abs(user.id - qid).toString()),
        anonId: this.asyncQuestionService.getAnonId(user.id, qid),
        photoURL: user.photoURL,
        isAuthor: comment.creator.id === question.creatorId,
      } as AsyncCreator as unknown as UserModel;
    }
    res.status(HttpStatus.CREATED).send(comments);
  }

  @Patch('comment/:qid/:commentId')
  @UseGuards(AsyncQuestionRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async updateComment(
    @Param('qid', ParseIntPipe) qid: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() body: AsyncQuestionCommentParams,
    @UserId() userId: number,
    @CourseRole() courseRole: Role,
    @Res() res: Response,
  ): Promise<Response> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: qid },
    });

    const courseSettings = await CourseSettingsModel.findOne({
      where: { courseId: question.courseId },
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

    comment.commentText = body.commentText;

    const isStaff = courseRole == Role.TA || courseRole == Role.PROFESSOR;
    const isAuthor = userId == question.creatorId;
    comment.isAnonymous =
      isStaff && !isAuthor
        ? false
        : isAuthor
          ? question.isAnonymous
          : (body.isAnonymous ??
            courseSettings?.asyncCentreDefaultAnonymous ??
            true);
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

    const otherComments = await AsyncQuestionCommentModel.find({
      where: {
        creatorId: userId,
        questionId: qid,
        id: Not(comment.id),
      },
    });
    const originalAnons = otherComments.map((c) => c.isAnonymous);
    otherComments.forEach((oc) => (oc.isAnonymous = comment.isAnonymous));
    await AsyncQuestionCommentModel.save(
      otherComments.filter((v, i) => originalAnons[i] != v.isAnonymous),
    );

    res.status(HttpStatus.OK).send([comment, otherComments]);
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
    let all: AsyncQuestionModel[];

    if (!asyncQuestionKeys || Object.keys(asyncQuestionKeys).length === 0) {
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

    let questions: Partial<AsyncQuestionModel>[];

    const isStaff: boolean =
      userCourse.role === Role.TA || userCourse.role === Role.PROFESSOR;
    const courseSettings = await CourseSettingsModel.findOne({
      where: { courseId: courseId },
    });

    if (isStaff) {
      // Staff sees all questions except the ones deleted
      questions = all.filter(
        (question) => question.status !== asyncQuestionStatus.TADeleted,
      );
    } else {
      // Students see their own questions and questions that are visible
      questions = (
        await Promise.all(
          all.map(async (question) => {
            if (
              question.creatorId === userId ||
              (await this.asyncQuestionService.isVisible(
                question,
                courseSettings,
              ))
            ) {
              return question;
            } else {
              return undefined;
            }
          }),
        )
      ).filter((s) => s != undefined);
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
        'isAnonymous',
        'staffSetVisible',
        'authorSetVisible',
        'verified',
        'votes',
        'comments',
        'questionTypes',
        'votesSum',
        'isTaskQuestion',
      ]);

      if (!question.comments) {
        temp.comments = [];
      } else {
        temp.comments = question.comments.map((comment) => {
          const temp = { ...comment };
          // TODO: maybe find a more performant way of doing this (ideally in the query itself, and maybe try to include a SELECT to eliminate the pick() above. Though this may be difficult due to some of these use functions like nameToRGB or getAnonId)
          const commenterRole =
            comment.creator.courses.find(
              (course) => course.courseId === question.courseId,
            )?.role || Role.STUDENT;

          temp.creator =
            isStaff || comment.creator.id === userId || !comment.isAnonymous
              ? ({
                  id: comment.creator.id,
                  anonId: this.asyncQuestionService.getAnonId(
                    comment.creator.id,
                    question.id,
                  ),
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
                  anonId: this.asyncQuestionService.getAnonId(
                    comment.creator.id,
                    question.id,
                  ),
                  colour: nameToRGB(
                    Math.abs(comment.creatorId - question.id).toString(),
                  ),
                  photoURL: null,
                  isAuthor: comment.creator.id === question.creatorId,
                  courseRole: commenterRole,
                } as AsyncCreator as unknown as UserModel);

          delete temp.creatorId;

          return temp as unknown as AsyncQuestionCommentModel;
        });
      }

      Object.assign(temp, {
        creator:
          isStaff || question.creator.id == userId || !question.isAnonymous
            ? {
                id: question.creator.id,
                anonId: this.asyncQuestionService.getAnonId(
                  question.creator.id,
                  question.id,
                ),
                colour: nameToRGB(
                  Math.abs(question.creator.id - question.id).toString(),
                ),
                name: question.creator.name,
                photoURL: question.creator.photoURL,
              }
            : {
                anonId: this.asyncQuestionService.getAnonId(
                  question.creator.id,
                  question.id,
                ),
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

  // Moved from userInfo context endpoint as this updates too frequently to make sense caching it with userInfo data
  @Get('unread_async_count/:courseId')
  @UseGuards(JwtAuthGuard)
  async getUnreadAsyncCount(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UserId() userId: number,
  ): Promise<UnreadAsyncQuestionResponse> {
    const count = await UnreadAsyncQuestionModel.count({
      where: {
        userId,
        courseId,
        readLatest: false,
      },
    }); // typescript says that count is just a number but sometimes its not so I'm making it 0 if its falsey
    return { count: count ? count : 0 };
  }

  @Patch('unread_async_count/:courseId')
  @UseGuards(JwtAuthGuard) // technically this could use a courseRolesGuard but since can only update your own unread count it doesn't really matter
  async updateUnreadAsyncCount(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UserId() userId: number,
  ): Promise<void> {
    await UnreadAsyncQuestionModel.update(
      { userId, courseId },
      { readLatest: true },
    );
    return;
  }
}
