import { Test, TestingModule } from '@nestjs/testing'
import { TestConfigModule, TestTypeOrmModule } from '../../../../test/util/testUtils'
import { FactoryModule } from '../../../factory/factory.module'
import { DataSource } from 'typeorm'
import { FactoryService } from '../../../factory/factory.service'
import {
  CourseFactory,
  EmbeddableQuestionFactory,
  EmbeddableQuestionFeedbackFactory,
  initFactoriesFromService,
  UserFactory,
} from '../../../../test/util/factories'
import { EmbeddableQuestionService } from './embeddable-question.service'
import { CourseModel } from '../../../course/course.entity'
import { EmbeddableQuestionModel } from './embeddable-question.entity'
import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ERROR_MESSAGES } from '@koh/common'
import { pick } from 'lodash'
import { EmbeddableModule } from '../embeddable.module'
import { ChatbotApiService } from '../../../chatbot/chatbot-api.service'
import { EmbeddableQuestionFeedbackModel } from './embeddable-question-feedback.entity'
import { EmbeddableModuleService } from '../embeddable-module.service'
import { ChatbotModule } from '../../../chatbot/chatbot.module'

describe('EmbeddableQuestionService', () => {
  let service: EmbeddableQuestionService;
  let dataSource: DataSource;

  let course: CourseModel;
  let questions: EmbeddableQuestionModel[];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        FactoryModule,
        EmbeddableModule,
        ChatbotModule,
      ],
      providers: [EmbeddableQuestionService, EmbeddableModuleService],
    }).compile();

    service = module.get<EmbeddableQuestionService>(EmbeddableQuestionService);
    dataSource = module.get<DataSource>(DataSource);

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    if (!dataSource) return;
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);

    course = await CourseFactory.create()
    for (let i = 0; i < 3; i++) {
      await EmbeddableQuestionFactory.create({
        course,
        questionText: `Question ${i+1}`,
        criteriaText: `Criteria ${i+1}`,
        instructions: i == 2 ? 'Instructions' : undefined,
      })
    }
    questions = await EmbeddableQuestionModel.find({ where: { course }})
  });

  describe('getFeedback()', () => {
    it('should fail if question is not available yet', async () => {
      const course = await CourseFactory.create()
      const question = await EmbeddableQuestionFactory.create({
        course,
        availableFrom: new Date(Date.now()+1000),
      });
      await expect(service.getFeedback('',question.id,course.id,0)).rejects.toThrow(new UnauthorizedException(ERROR_MESSAGES.embeddableModule.notAvailableYet));
    });

    it('should fail if question is no longer available', async () => {
      const course = await CourseFactory.create()
      const question = await EmbeddableQuestionFactory.create({
        course,
        availableUntil: new Date(Date.now()-1000),
      });
      await expect(service.getFeedback('',question.id,course.id,0)).rejects.toThrow(new UnauthorizedException(ERROR_MESSAGES.embeddableModule.noLongerAvailable));
    });

    it('should return feedback & grade and save it', async () => {
      const user = await UserFactory.create();
      const querySpy = jest.spyOn(ChatbotApiService.prototype,'queryChatbot')

      querySpy.mockImplementation(async (_q,_t,type, _p, _c) => {
        if (type === 'feedback') return 'feedback';
        if (type === 'grade') return '100';
      });

      const feedback = await service.getFeedback('',questions[0].id,course.id,user.id);

      expect(pick(feedback,['aiFeedback','aiGrade'])).toEqual({
        aiFeedback: 'feedback',
        aiGrade: 100,
      });

      querySpy.mockClear();
    });
  });

  describe('findAllForCourse()', () => {
    it('should return all embeddable questions for a given course', async () => {
      const qs = await service.findAllForCourse(course.id);
      expect(qs).toEqual(questions);
    });
  });

  describe('findOne()', () => {
    it('should throw an error if question is not found', async () => {
      await expect(service.findOne(0)).rejects.toThrow(new NotFoundException(ERROR_MESSAGES.embeddableModule.notFound))
    });

    it('should a specific embeddable question if found', async () => {
      const q = await service.findOne(questions[0].id);
      expect(q).toEqual(questions[0]);
    });
  });

  describe('upsert()', () => {
    it('should update an existing question', async () => {
      const prev = pick(questions[2],['criteriaText','questionText','instructions'])
      const result = await service.upsert(course.id, {
        criteriaText: 'updated criteria',
        questionText: 'updated question',
        instructions: 'updated instruction',
      }, questions[2].id);
      const retrieve = await EmbeddableQuestionModel.findOne({
        where: {
          id: questions[2].id
        }
      });
      const sub = pick(retrieve,['criteriaText','questionText','instructions']);
      expect(sub).not.toEqual(prev);
      expect(sub).toEqual(pick(result,['criteriaText','questionText','instructions']));
    });

    it('should create a non-existing question', async () => {
      const result = await service.upsert(course.id, {
        criteriaText: 'new criteria',
        questionText: 'new question',
        instructions: 'new instruction',
      });
      const retrieve = await EmbeddableQuestionModel.findOne({ where: { id: result.id }});
      expect(retrieve).toBeDefined();
      expect(pick(retrieve,['criteriaText','questionText','instructions'])).toEqual({
        criteriaText: 'new criteria',
        questionText: 'new question',
        instructions: 'new instruction',
      });
    });
  });

  describe('delete()', () => {
    it('should delete a question with given id', async () => {
      await service.delete(questions[0].id);
      expect(await EmbeddableQuestionModel.findOne({where: {id: questions[0].id}})).toBeFalsy();
    });
  });

  describe('getAnswers()', () => {
    it('should retrieve answers for the given embeddable question ID', async () => {
      const question = await EmbeddableQuestionFactory.create();
      await EmbeddableQuestionFeedbackFactory.createList(3,{
        embeddableQuestion: question,
      });
      expect(await service.getAnswers(question.id)).toHaveLength(3);
    });
  });

  describe('updateAnswer()', () => {
    it('should update an answer with the given human feedback and grade', async () => {
      const feedback = await EmbeddableQuestionFeedbackFactory.create();

      const params = {
        humanFeedback: 'feedback',
        humanGrade: 60,
      }
      await service.updateAnswer(feedback.id, params);

      const retrieve = await EmbeddableQuestionFeedbackModel.findOne({
        where: {
          id: feedback.id,
        }
      });
      expect(pick(retrieve,['humanFeedback','humanGrade'])).toEqual(params)
    });
  });

  describe('deleteAnswer()', () => {
    it('should delete an answer with the given ID', async () => {
      const feedback = await EmbeddableQuestionFeedbackFactory.create();
      await service.deleteAnswer(feedback.id);
      expect(await EmbeddableQuestionFeedbackModel.findOne({
        where: {
          id: feedback.id,
        }
      })).toBeFalsy();
    });
  });

  // TODO: Feasible test cases for this, it returns a buffer so is difficult to validate
  // describe('exportFeedback()', () => {
  //
  // });
});