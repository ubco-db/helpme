import {
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  GetQueueResponse,
  LimboQuestionStatus,
  ListQuestionsResponse,
  OpenQuestionStatus,
  QueueConfig,
  Role,
  UpdateQueueParams,
  setQueueConfigResponse,
  validateQueueConfigInput,
} from '@koh/common';
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { UserId } from 'decorators/user.decorator';
import { Connection, getManager } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { QueueCleanService } from './queue-clean/queue-clean.service';
import { QueueRole } from '../decorators/queue-role.decorator';
import { QueueRolesGuard } from '../guards/queue-role.guard';
import { QueueSSEService } from './queue-sse.service';
import { QueueModel } from './queue.entity';
import { QueueService } from './queue.service';
import { QuestionModel } from '../question/question.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { QuestionTypeModel } from 'questionType/question-type.entity';

@Controller('queues')
@UseGuards(JwtAuthGuard, QueueRolesGuard, EmailVerifiedGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class QueueController {
  constructor(
    private connection: Connection,
    private queueSSEService: QueueSSEService,
    private queueCleanService: QueueCleanService,
    private queueService: QueueService, //note: this throws errors, be sure to catch them
  ) {}

  @Get(':queueId')
  @Roles(Role.TA, Role.PROFESSOR, Role.STUDENT)
  async getQueue(@Param('queueId') queueId: number): Promise<GetQueueResponse> {
    try {
      return this.queueService.getQueue(queueId);
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.getQueue,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get(':queueId/questions')
  @Roles(Role.TA, Role.PROFESSOR, Role.STUDENT)
  async getQuestions(
    @Param('queueId') queueId: number,
    @QueueRole() role: Role,
    @UserId() userId: number,
  ): Promise<ListQuestionsResponse> {
    try {
      const questions = await this.queueService.getQuestions(queueId);
      return await this.queueService.personalizeQuestions(
        queueId,
        questions,
        userId,
        role,
      );
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.getQuestions,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Patch(':queueId')
  @Roles(Role.TA, Role.PROFESSOR)
  async updateQueue(
    @Param('queueId') queueId: number,
    @Body() body: UpdateQueueParams,
  ): Promise<QueueModel> {
    const queue = await this.queueService.getQueue(queueId);
    if (queue === undefined) {
      throw new NotFoundException();
    }
    queue.notes = body.notes;
    queue.allowQuestions = body.allowQuestions;
    try {
      await queue.save();
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.saveQueue,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return queue;
  }

  @Post(':queueId/clean')
  @Roles(Role.TA, Role.PROFESSOR)
  async cleanQueue(@Param('queueId') queueId: number): Promise<void> {
    // Clean up queue if necessary
    try {
      setTimeout(async () => {
        await this.queueCleanService.cleanQueue(queueId, true);
        await this.queueSSEService.updateQueue(queueId);
      });
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.cleanQueue,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Endpoint to send frontend receive server-sent events when queue changes
  @Get(':queueId/sse')
  sendEvent(
    @Param('queueId') queueId: number,
    @QueueRole() role: Role,
    @UserId() userId: number,
    @Res() res: Response,
  ): void {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });

    try {
      this.queueSSEService.subscribeClient(queueId, res, { role, userId });
    } catch (err) {
      console.error(err);
    }
  }

  @Delete(':queueId')
  @Roles(Role.TA, Role.PROFESSOR)
  async disableQueue(
    @Param('queueId') queueId: number,
    @QueueRole() role: Role,
  ): Promise<void> {
    // disable a queue
    const queue = await this.queueService.getQueue(queueId);
    if (!queue) {
      throw new NotFoundException();
    }

    if (queue.isProfessorQueue && role === Role.TA) {
      throw new HttpException(
        ERROR_MESSAGES.queueController.cannotCloseQueue,
        HttpStatus.UNAUTHORIZED,
      );
    }

    queue.isDisabled = true;

    // clear staff list
    queue.staffList = [];

    const questions = await QuestionModel.inQueueWithStatus(queueId, [
      ...Object.values(OpenQuestionStatus),
      ...Object.values(LimboQuestionStatus),
    ]).getMany();

    questions.forEach((q: QuestionModel) => {
      q.status = ClosedQuestionStatus.Stale;
      q.closedAt = new Date();
    });

    try {
      // try to save queue (and stale questions!)
      await QuestionModel.save(questions);
      await queue.save();
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.saveQueue,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':queueId/configa')
  @Roles(Role.TA, Role.PROFESSOR)
  async setConfiga(
    @Param('queueId') queueId: number,
    @Body() config: QueueConfig,
  ): Promise<setQueueConfigResponse> {
    // make sure queue config is valid
    const configError = validateQueueConfigInput(config);
    if (configError) {
      throw new HttpException(configError, HttpStatus.BAD_REQUEST);
    }

    const queue = await this.queueService.getQueue(queueId);
    if (!queue) {
      throw new NotFoundException();
    }
    const oldConfig = queue.config;

    Object.entries(config.tags).forEach(async ([tagId, tag]) => {
      if (oldConfig.tags[tagId]) {
        //// update the question type
        // first find the existing question type using queueid and the display_name
        const oldQuestionType = await QuestionTypeModel.findOne({
          where: { queueId: queueId, name: tag.display_name },
        });
        // set the values
        oldQuestionType.color = tag.color_hex;
        oldQuestionType.name = tag.display_name;
        // save the question type
        await oldQuestionType.save();
      } else {
        // create a new question type
        const newQuestionType = new QuestionTypeModel();
        newQuestionType.queueId = queueId;
        newQuestionType.color = tag.color_hex;
        newQuestionType.name = tag.display_name;
        await newQuestionType.save();
      }
    });

    try {
      // set config for a queue
      queue.config = config;
      await queue.save();
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.saveQueue,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { questionTypeMessages: [] };
  }

  // Sets the JSON config for a queue and then returns success + any question tags that were created/deleted/updated
  // note: for whatever reason, anytime you `return` a res.send(), you get "cannot set headers after they are sent" even though that's what you're supposed to do
  @Patch(':queueId/config')
  @Roles(Role.TA, Role.PROFESSOR)
  async setConfig(
    @Param('queueId') queueId: number,
    @Body() newConfig: QueueConfig,
    @Res() res: Response,
  ): Promise<Response<setQueueConfigResponse>> {
    // make sure queue config is valid
    const configError = validateQueueConfigInput(newConfig);
    if (configError) {
      res.status(HttpStatus.BAD_REQUEST).send({ message: configError });
      return;
    }

    let queue: QueueModel;
    try {
      queue = await this.queueService.getQueue(queueId);
    } catch {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: ERROR_MESSAGES.queueRoleGuard.queueNotFound });
      return;
    }

    const oldConfig: QueueConfig = queue.config ?? { tags: {} };
    const questionTypeMessages: string[] = []; // this will contain messages about what question types were created, updated, or deleted

    try {
      await getManager().transaction(async (transactionalEntityManager) => {
        // update the question types
        // to do so, compare the tag ids of the old config vs the new config:
        // - if there's a new tag id, make a new question type
        // - if there's a missing tag id, delete the question type
        // - if there's a tag id that's in both, update the question type

        // tags to delete
        const oldTagKeys =
          oldConfig && oldConfig.tags ? Object.keys(oldConfig.tags) : [];
        const newTagKeys = Object.keys(newConfig.tags);
        const tagsToDelete = oldTagKeys.filter(
          (tag) => !newTagKeys.includes(tag),
        );
        for (const tagId of tagsToDelete) {
          const deleted = await transactionalEntityManager.delete(
            QuestionTypeModel,
            { queueId, name: oldConfig.tags[tagId].display_name },
          );
          if (deleted.affected > 0) {
            questionTypeMessages.push(
              `Deleted tag: ${oldConfig.tags[tagId].display_name}`,
            );
          }
        }

        // tags to update or create
        for (const [newTagId, newTag] of Object.entries(newConfig.tags)) {
          if (oldConfig && oldConfig.tags && oldConfig.tags[newTagId]) {
            // update the question type if the color_hex or display_name has changed
            const oldTag = oldConfig.tags[newTagId];
            if (
              oldTag.color_hex !== newTag.color_hex ||
              oldTag.display_name !== newTag.display_name
            ) {
              const updated = await transactionalEntityManager.update(
                QuestionTypeModel,
                { queueId, name: oldTag.display_name },
                { color: newTag.color_hex, name: newTag.display_name },
              );
              if (updated.affected > 0) {
                questionTypeMessages.push(
                  `Updated tag: ${newTag.display_name}`,
                );
              }
            }
          } else {
            // create a new question type
            await transactionalEntityManager.insert(QuestionTypeModel, {
              queueId,
              cid: queue.courseId,
              color: newTag.color_hex,
              name: newTag.display_name,
            });
            questionTypeMessages.push(`Created tag: ${newTag.display_name}`);
          }
        }

        // set config for a queue
        queue.config = newConfig;
        await transactionalEntityManager.save(queue);
      });
    } catch (err) {
      console.error(err); // internal server error: figure out what went wrong
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ message: ERROR_MESSAGES.queueController.saveQueue });
      return;
    }
    res.send({ questionTypeMessages });
    return;
  }
}
