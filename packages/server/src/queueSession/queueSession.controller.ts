import { Role } from '@koh/common';
import {
  Controller,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  Body,
  Get,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { Roles } from 'decorators/roles.decorator';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { Connection, getManager } from 'typeorm';
import { Response } from 'express';
import { QueueModel } from 'queue/queue.entity';
import { QueueSessionModel } from 'queueSession/queueSession.entity';

// TODO: maybe move this to queue folder?

@Controller('queueSession')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class QueueSessionController {
  constructor(private connection: Connection) {}

  // creates a new queue session with the given config and starts the session for the queue, returns the new queue session id
  @Roles(Role.TA, Role.PROFESSOR)
  @Post('createQueueSession/:qid')
  async createQueueSession(
    @Res() res: Response,
    @Param('qid') queueId: number,
    @Body('queueSessionConfig') queueSessionConfig: object,
  ): Promise<void> {
    try {
      await getManager().transaction(async (transactionalEntityManager) => {
        // create queue session
        const queueSession = await transactionalEntityManager
          .create(QueueSessionModel, {
            qid: queueId,
            startTime: new Date(),
            config: queueSessionConfig,
          })
          .save();

        //create question types based on config

        // update queue with new queue session
        const queue = await transactionalEntityManager.findOneOrFail(
          QueueModel,
          queueId,
        );
        queue.currentQueueSession = queueSession;
        await transactionalEntityManager.save(queue);
        res.status(200).send(queueSession.id);
      });
    } catch (err) {
      if (err.name === 'QueryFailedError') {
        res
          .status(400)
          .send(
            'Failed to create a new queue session or update the queue with the new session',
          );
      } else if (err.name === 'EntityNotFound') {
        res.status(404).send('The specified queue does not exist');
      } else {
        res.status(400).send(`An unexpected error occurred: ${err.message}`);
      }
    }
  }

  // sets currentQueueSessionId in QueueModel to null
  // @Roles(Role.TA, Role.PROFESSOR)
  // @Post('endQueueSession/:qid')
  // async endQueueSession(
  //   @Res() res: Response,
  //   @Param('qid') queueId: number,
  // ): Promise<void> {
  // }

  // @Roles(Role.TA, Role.PROFESSOR, Role.STUDENT)
  // @Get('QueueSessionConfig/:qsid')
  // async getQueueSessionConfig(
  //   @Res() res: Response,
  //   @Param('qsid') queueSessionId: number,
  // ): Promise<void> {
  // }
}
