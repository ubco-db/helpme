import {
  CreateAsyncQuestions,
  ERROR_MESSAGES,
  Role,
  AsyncQuestionParams,
  asyncQuestionStatus,
  UpdateAsyncQuestions,
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
import { AsyncQuestionVotesModel } from './asyncQuestionVotes.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { RedisQueueService } from '../redisQueue/redis-queue.service';

@Controller('asyncQuestions')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class asyncQuestionController {
  constructor(private readonly redisQueueService: RedisQueueService) {}

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

  @Patch(':questionId')
  async updateQuestion(
    @Param('questionId') questionId: number,
    @Body() body: UpdateAsyncQuestions,
    @User() user: UserModel,
  ): Promise<AsyncQuestionParams> {
    const question = await AsyncQuestionModel.findOne({
      where: { id: questionId },
      relations: ['course', 'creator', 'taHelped', 'votes'],
    });

    if (question === undefined) {
      throw new NotFoundException();
    }

    const courseId = question.course.id;

    delete question.course;

    // If not creator, check if user is TA/PROF of course of question
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
    }
    if (body.status === asyncQuestionStatus.HumanAnswered) {
      question.taHelpedId = user.id;
    }
    // if creator, can update question anytime
    // otherwise has to be TA/PROF of course
    if (question.creatorId !== user.id) {
      const requester = await UserCourseModel.findOne({
        where: {
          userId: user.id,
          courseId: courseId,
        },
      });
      if (!requester || requester.role === Role.STUDENT) {
        throw new HttpException(
          'You must be staff in order to update questions other than your own',
          HttpStatus.UNAUTHORIZED,
        );
      }
    } else {
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
