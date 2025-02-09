import { ClosedQuestionStatus, OpenQuestionStatus } from '@koh/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection } from 'typeorm';
import { QuestionFactory, QueueFactory } from '../../test/util/factories';
import { TestTypeOrmModule } from '../../test/util/testUtils';
import { QueueModel } from './queue.entity';

describe('queue entity', () => {
  let conn: Connection;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule],
    }).compile();

    conn = module.get<Connection>(Connection);
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await conn.synchronize(true);
  });

  it('queueSize is handled properly and is equal to them sum of Queued, Drafting, and Helping questions', async () => {
    const queueFactory = await QueueFactory.create();

    await QuestionFactory.create({
      queue: queueFactory,
      status: OpenQuestionStatus.Queued,
    });
    await QuestionFactory.create({
      queue: queueFactory,
      status: OpenQuestionStatus.Drafting,
    });
    await QuestionFactory.create({
      queue: queueFactory,
      status: OpenQuestionStatus.Helping,
    });
    await QuestionFactory.create({
      queue: queueFactory,
      status: ClosedQuestionStatus.Resolved,
    });

    const otherQueueWithQuestions = await QueueFactory.create();
    for (let i = 0; i < 4; i++) {
      await QuestionFactory.create({
        queue: otherQueueWithQuestions,
        status: OpenQuestionStatus.Queued,
      });
    }

    const queue = await QueueModel.findOne({
      where: {
        id: queueFactory.id,
      },
    });
    await queue.addQueueSize();

    expect(queue.queueSize).toBe(3);
  });
});
