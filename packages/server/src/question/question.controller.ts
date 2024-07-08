import {
  ClosedQuestionStatus,
  CreateQuestionParams,
  CreateQuestionResponse,
  ERROR_MESSAGES,
  LimboQuestionStatus,
  OpenQuestionStatus,
  questions,
  QuestionStatusKeys,
  Role,
  UpdateQuestionParams,
  UpdateQuestionResponse,
} from '@koh/common';
import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { In } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  NotificationService,
  NotifMsgs,
} from '../notification/notification.service';
import { Roles } from '../decorators/roles.decorator';
import { UserCourseModel } from '../profile/user-course.entity';
import { User, UserId } from '../decorators/user.decorator';
import { UserModel } from '../profile/user.entity';
import { QueueModel } from '../queue/queue.entity';
import { QuestionRolesGuard } from '../guards/question-role.guard';
import { QuestionModel } from './question.entity';
import { QuestionTypeModel } from '../questionType/question-type.entity';
import { pick } from 'lodash';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { QueueService } from '../queue/queue.service';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { QuestionService } from './question.service';

// NOTE: FIXME: EVERY REQUEST INTO QUESTIONCONTROLLER REQUIRES THE BODY TO HAVE A
// FIELD questionId OR queueId! If not, stupid weird untraceable bugs will happen
// and you will lose a lot of development time
@Controller('questions')
@UseGuards(JwtAuthGuard, QuestionRolesGuard, EmailVerifiedGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class QuestionController {
  constructor(
    private notifService: NotificationService,
    private questionService: QuestionService,
    private queueService: QueueService,
    private redisQueueService: RedisQueueService,
  ) {}

  @Get('allQuestions/:cid')
  async getAllQuestions(@Param('cid') cid: number): Promise<questions[]> {
    const questions = await QuestionModel.find({
      relations: ['queue', 'creator', 'taHelped'],
      where: {
        queue: {
          courseId: cid,
        },
      },
    });

    if (questions === undefined) {
      throw new NotFoundException();
    }
    const questionRes = questions.map((q) => {
      const temp = pick(q, [
        'id',
        'queueId',
        'text',
        'questionTypes',
        'createdAt',
        'helpedAt',
        'closedAt',
        'status',
        'location',
        'isTaskQuestion',
      ]);
      Object.assign(temp, {
        creatorName: q.creator?.name,
        helpName: q.taHelped?.name,
      });
      return temp;
    });
    return questionRes;
  }

  @Post('TAcreate/:userId')
  async TAcreateQuestion(
    @Body() body: CreateQuestionParams,
    @Param('userId') userId: number,
  ): Promise<any> {
    const { text, questionTypes, groupable, isTaskQuestion, queueId, force } =
      body;

    const queue = await QueueModel.findOne({
      where: { id: queueId },
      relations: ['staffList'],
    });

    if (!queue) {
      throw new NotFoundException(
        ERROR_MESSAGES.questionController.createQuestion.invalidQueue,
      );
    }

    if (!queue.allowQuestions) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.createQuestion.noNewQuestions,
      );
    }
    if (!(await queue.checkIsOpen())) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.createQuestion.closedQueue,
      );
    }

    // don't allow more than 1 demo and 1 question per user per course
    const previousUserQuestions = await QuestionModel.find({
      relations: ['queue'],
      where: {
        creatorId: userId,
        status: In(Object.values(OpenQuestionStatus)),
      },
    });
    const previousCourseQuestions = previousUserQuestions.filter(
      (question) => question.queue.courseId === queue.courseId,
    );
    const studentDemo = previousCourseQuestions?.find(
      (question) => question.isTaskQuestion,
    );
    const studentQuestion = previousCourseQuestions?.find(
      (question) => !question.isTaskQuestion,
    );
    if (studentQuestion && !isTaskQuestion) {
      if (force) {
        studentQuestion.status = ClosedQuestionStatus.ConfirmedDeleted;
        await studentQuestion.save();
      } else {
        throw new BadRequestException(
          ERROR_MESSAGES.questionController.createQuestion.oneQuestionAtATime,
        );
      }
    } else if (studentDemo && isTaskQuestion) {
      if (force) {
        studentDemo.status = ClosedQuestionStatus.ConfirmedDeleted;
        await studentDemo.save();
      } else {
        throw new BadRequestException(
          ERROR_MESSAGES.questionController.createQuestion.oneDemoAtATime,
        );
      }
    }

    const user = await UserModel.findOne({
      where: {
        id: userId,
      },
    });
    try {
      const question = await QuestionModel.create({
        queueId: queueId,
        creator: user,
        text,
        questionTypes,
        groupable,
        isTaskQuestion,
        status: QuestionStatusKeys.Queued,
        createdAt: new Date(),
      }).save();

      const questions = await this.queueService.getQuestions(queueId);

      await this.redisQueueService.setQuestions(`q:${queueId}`, questions);

      return question;
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.questionController.saveQError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @Roles(Role.STUDENT)
  async createQuestion(
    @Body() body: CreateQuestionParams,
    @User() user: UserModel,
  ): Promise<CreateQuestionResponse> {
    const { text, questionTypes, groupable, isTaskQuestion, queueId, force } =
      body;

    const queue = await QueueModel.findOne({
      where: { id: queueId },
      relations: ['staffList'],
    });

    if (!queue) {
      throw new NotFoundException(
        ERROR_MESSAGES.questionController.createQuestion.invalidQueue,
      );
    }

    if (!queue.allowQuestions) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.createQuestion.noNewQuestions,
      );
    }
    if (!(await queue.checkIsOpen())) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.createQuestion.closedQueue,
      );
    }

    // don't allow more than 1 demo and 1 question per user per course
    const previousUserQuestions = await QuestionModel.find({
      relations: ['queue'],
      where: {
        creatorId: user.id,
        status: In(Object.values(OpenQuestionStatus)),
      },
    });
    const previousCourseQuestions = previousUserQuestions.filter(
      (question) => question.queue.courseId === queue.courseId,
    );
    const studentDemo = previousCourseQuestions?.find(
      (question) => question.isTaskQuestion,
    );
    const studentQuestion = previousCourseQuestions?.find(
      (question) => !question.isTaskQuestion,
    );
    if (studentQuestion && !isTaskQuestion) {
      if (force) {
        studentQuestion.status = ClosedQuestionStatus.ConfirmedDeleted;
        await studentQuestion.save();
      } else {
        throw new BadRequestException(
          ERROR_MESSAGES.questionController.createQuestion.oneQuestionAtATime,
        );
      }
    } else if (studentDemo && isTaskQuestion) {
      if (force) {
        studentDemo.status = ClosedQuestionStatus.ConfirmedDeleted;
        await studentDemo.save();
      } else {
        throw new BadRequestException(
          ERROR_MESSAGES.questionController.createQuestion.oneDemoAtATime,
        );
      }
    }

    let types = [];
    if (questionTypes) {
      types = await Promise.all(
        questionTypes.map(async (type) => {
          const questionType = await QuestionTypeModel.findOne({
            where: {
              id: type.id,
            },
          });
          if (!questionType) {
            throw new BadRequestException(
              ERROR_MESSAGES.questionController.createQuestion.invalidQuestionType,
            );
          }
          return questionType;
        }),
      );
    }

    const newQuestion = QuestionModel.create({
      queueId: queueId,
      creator: user,
      text,
      questionTypes: types,
      groupable,
      isTaskQuestion,
      status: QuestionStatusKeys.Drafting,
      createdAt: new Date(),
    });
    // check to make sure all tasks are in the config
    if (text != '' && isTaskQuestion) {
      await this.questionService.checkIfValidTaskQuestion(newQuestion, queue);
    }

    try {
      await newQuestion.save();

      const questions = await this.queueService.getQuestions(queueId);

      await this.redisQueueService.setQuestions(`q:${queueId}`, questions);

      return newQuestion;
    } catch (err) {
      console.log(err);
      throw new HttpException(
        ERROR_MESSAGES.questionController.saveQError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':questionId')
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  // TODO: Use queueRole decorator, but we need to fix its performance first
  async updateQuestion(
    @Param('questionId') questionId: number,
    @Body() body: UpdateQuestionParams,
    @UserId() userId: number,
  ): Promise<UpdateQuestionResponse> {
    let question = await QuestionModel.findOne({
      where: { id: questionId },
      relations: ['creator', 'queue', 'taHelped'],
    });

    if (question === undefined) {
      throw new NotFoundException();
    }

    const isCreator = userId === question.creatorId;

    // creating/editing your own question
    if (isCreator) {
      // Fail if student tries an invalid status change
      if (body.status && !question.changeStatus(body.status, Role.STUDENT)) {
        throw new UnauthorizedException(
          ERROR_MESSAGES.questionController.updateQuestion.fsmViolation(
            'Student',
            question.status,
            body.status,
          ),
        );
      }
      question = Object.assign(question, body);
      if (body.questionTypes) {
        question.questionTypes = await Promise.all(
          body.questionTypes.map(async (type) => {
            const questionType = await QuestionTypeModel.findOne({
              where: {
                id: type.id,
              },
            });
            if (!questionType) {
              throw new BadRequestException(
                ERROR_MESSAGES.questionController.createQuestion.invalidQuestionType,
              );
            }
            return questionType;
          }),
        );
      }

      if (
        question.isTaskQuestion &&
        question.status !== ClosedQuestionStatus.ConfirmedDeleted &&
        question.status !== ClosedQuestionStatus.DeletedDraft &&
        question.status !== ClosedQuestionStatus.Stale &&
        question.status !== OpenQuestionStatus.Drafting
      ) {
        let queue: QueueModel;
        try {
          queue = await QueueModel.findOneOrFail(question.queueId);
        } catch (err) {
          throw new NotFoundException(
            ERROR_MESSAGES.questionController.studentTaskProgress.queueDoesNotExist,
          );
        }
        // check to make sure all tasks are in the config
        await this.questionService.checkIfValidTaskQuestion(question, queue);
      }

      try {
        await question.save();
        const questions = await this.queueService.getQuestions(
          question.queue.id,
        );
        await this.redisQueueService.setQuestions(
          `q:${question.queue.id}`,
          questions,
        );
      } catch (err) {
        console.error(err);
        throw new HttpException(
          ERROR_MESSAGES.questionController.saveQError,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      return question;
    }

    //If not creator, check if user is TA/PROF of course of question
    const isTaOrProf =
      (await UserCourseModel.count({
        where: {
          userId,
          courseId: question.queue.courseId,
          role: In([Role.TA, Role.PROFESSOR]),
        },
      })) > 0;

    if (isTaOrProf) {
      if (Object.keys(body).length !== 1 || Object.keys(body)[0] !== 'status') {
        throw new UnauthorizedException(
          ERROR_MESSAGES.questionController.updateQuestion.taOnlyEditQuestionStatus,
        );
      }
      await this.questionService.validateNotHelpingOther(body.status, userId);
      await this.questionService.changeStatus(body.status, question, userId);
      // if it's a task question, update the studentTaskProgress for the student
      if (
        question.status === ClosedQuestionStatus.Resolved &&
        question.isTaskQuestion
      ) {
        await this.questionService.markTasksDone(question, question.creatorId);
      }

      const questions = await this.queueService.getQuestions(question.queue.id);
      await this.redisQueueService.setQuestions(
        `q:${question.queue.id}`,
        questions,
      );

      return question;
    } else {
      throw new UnauthorizedException(
        ERROR_MESSAGES.questionController.updateQuestion.loginUserCantEdit,
      );
    }
  }

  @Post(':questionId/notify')
  @Roles(Role.TA, Role.PROFESSOR)
  async notify(@Param('questionId') questionId: number): Promise<void> {
    const question = await QuestionModel.findOne(questionId, {
      relations: ['queue'],
    });

    if (question === undefined || question === null) {
      throw new HttpException(
        ERROR_MESSAGES.questionController.notFound,
        HttpStatus.NOT_FOUND,
      );
    }

    if (question.status === LimboQuestionStatus.CantFind) {
      try {
        await this.notifService.notifyUser(
          question.creatorId,
          NotifMsgs.queue.ALERT_BUTTON,
        );
      } catch (err) {
        console.error(err);
        throw new HttpException(
          ERROR_MESSAGES.questionController.unableToNotifyUser,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } else if (question.status === LimboQuestionStatus.TADeleted) {
      try {
        await this.notifService.notifyUser(
          question.creatorId,
          NotifMsgs.queue.REMOVED,
        );
      } catch (err) {
        console.error(err);
        throw new HttpException(
          ERROR_MESSAGES.questionController.unableToNotifyUser,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Post('group')
  @Roles(Role.TA, Role.PROFESSOR)
  async groupQuestions(
    @Body() body: GroupQuestionsParams,
    @UserId() instructorId: number,
  ): Promise<void> {
    const questions = await QuestionModel.find({
      where: {
        id: In(body.questionIds),
      },
      relations: ['taHelped', 'creator'],
    });

    if (!questions.every((q) => q.groupable)) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.groupQuestions.notGroupable,
      );
    }

    await this.questionService.validateNotHelpingOther(
      QuestionStatusKeys.Helping,
      instructorId,
    );

    for (const question of questions) {
      await this.questionService.changeStatus(
        QuestionStatusKeys.Helping,
        question,
        instructorId,
      );
    }

    const queue = await QueueModel.findOne({
      where: {
        id: body.queueId,
      },
    });

    const creatorUserCourse = await UserCourseModel.findOne({
      where: {
        courseId: queue.courseId,
        userId: instructorId,
      },
    });

    await QuestionGroupModel.create({
      creatorId: creatorUserCourse.id, // this should be usercourse id
      queueId: body.queueId,
      questions: questions,
    }).save();

    return;
  }

  @Patch('resolveGroup/:group_id')
  @Roles(Role.TA, Role.PROFESSOR)
  async resolveGroup(
    @Param('group_id') groupId: number,
    @UserId() instructorId: number,
  ): Promise<void> {
    const group = await QuestionGroupModel.findOne({
      where: {
        id: groupId,
      },
      relations: ['questions', 'questions.taHelped', 'questions.creator'],
    });

    for (const question of group.questions) {
      // only resolve q's that weren't requeued/can't find
      if (question.status === OpenQuestionStatus.Helping) {
        await this.questionService.changeStatus(
          QuestionStatusKeys.Resolved,
          question,
          instructorId,
        );
      }
    }
  }
}
