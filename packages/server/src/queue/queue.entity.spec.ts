import { ClosedQuestionStatus, OpenQuestionStatus } from '@koh/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  initFactoriesFromService,
  QuestionFactory,
  QueueFactory,
} from '../../test/util/factories';
import { TestTypeOrmModule } from '../../test/util/testUtils';
import { QueueModel } from './queue.entity';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';

describe('queue entity', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, FactoryModule],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
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
