import { EmbeddableModuleService } from '../embeddable-module.service'
import { DataSource } from 'typeorm'
import { Test, TestingModule } from '@nestjs/testing'
import { TestConfigModule, TestTypeOrmModule } from '../../../../test/util/testUtils'
import { FactoryModule } from '../../../factory/factory.module'
import { FactoryService } from '../../../factory/factory.service'
import {
  CourseFactory,
  EmbeddableAssignmentFactory,
  EmbeddableAssignmentFeedbackFactory,
  EmbeddableAssignmentQuestionFactory,
  EmbeddableQuestionFactory,
  initFactoriesFromService,
  UserFactory,
} from '../../../../test/util/factories'
import { EmbeddableAssignmentService } from './embeddable-assignment.service'
import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { pick } from 'lodash'
import { CourseModel } from '../../../course/course.entity'
import { EmbeddableAssignmentModel } from './embeddable-assignment.entity'
import { ERROR_MESSAGES } from '@koh/common'
import { EmbeddableModule } from '../embeddable.module'
import { EmbeddableAssignmentQuestionModel } from './embeddable-assignment-question.entity'
import { ChatbotModule } from '../../../chatbot/chatbot.module'
import { ChatbotApiService } from '../../../chatbot/chatbot-api.service'
import { EmbeddableQuestionFeedbackModel } from '../question/embeddable-question-feedback.entity'
import { EmbeddableAssignmentFeedbackModel } from './embeddable-assignment-feedback.entity'
import { EmbeddableQuestionModel } from '../question/embeddable-question.entity'

describe('EmbeddableAssignmentService', () => {
  let service: EmbeddableAssignmentService;
  let dataSource: DataSource;

  let course: CourseModel;
  let assignments: EmbeddableAssignmentModel[];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        FactoryModule,
        ChatbotModule,
        EmbeddableModule,
      ],
      providers: [EmbeddableAssignmentService, EmbeddableModuleService],
    }).compile();

    service = module.get<EmbeddableAssignmentService>(EmbeddableAssignmentService);
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
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);

    course = await CourseFactory.create()
    for (let i = 0; i < 3; i++) {
      await EmbeddableAssignmentFactory.create({
        course,
        name: `Assignment ${i}`
      })
    }
    assignments = await EmbeddableAssignmentModel.find({ where: { course }})
  });

  describe('getFeedback()', () => {
    it('should fail if assignment is not available yet', async () => {
      const course = await CourseFactory.create()
      const assignment = await EmbeddableAssignmentFactory.create({
        course,
        availableFrom: new Date(Date.now()+1000),
      });
      const question = await EmbeddableQuestionFactory.create()
      await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      await expect(service.getFeedback('',assignment.id,question.id,course.id,0)).rejects.toThrow(new UnauthorizedException(ERROR_MESSAGES.embeddableModule.notAvailableYet));
    });

    it('should fail if assignment is no longer available', async () => {
      const course = await CourseFactory.create()
      const assignment = await EmbeddableAssignmentFactory.create({
        course,
        availableUntil: new Date(Date.now()-1000),
      });
      const question = await EmbeddableQuestionFactory.create()
      await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      await expect(service.getFeedback('',assignment.id,question.id,course.id,0)).rejects.toThrow(new UnauthorizedException(ERROR_MESSAGES.embeddableModule.noLongerAvailable));
    });

    it('should return feedback & grade and save it', async () => {
      const course = await CourseFactory.create()
      const assignment = await EmbeddableAssignmentFactory.create({
        course,
      });
      const question = await EmbeddableQuestionFactory.create()
      await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      const user = await UserFactory.create();
      const querySpy = jest.spyOn(ChatbotApiService.prototype,'queryChatbot')

      querySpy.mockImplementation(async (_q,_t,type, _p, _c) => {
        if (type === 'feedback') return 'feedback';
        if (type === 'grade') return '100';
      });

      const feedback = await service.getFeedback('',assignment.id,question.id,course.id,user.id);

      expect(pick(feedback,['aiFeedback','aiGrade'])).toEqual({
        aiFeedback: 'feedback',
        aiGrade: 100,
      });

      querySpy.mockClear();
    });
  });

  describe('findAllForCourse()', () => {
    it('should return all embeddable assignments for a given course', async () => {
      const qs = await service.findAllForCourse(course.id);
      expect(qs).toEqual(assignments);
    });
  });

  describe('findOne()', () => {
    it('should throw an error if assignment is not found', async () => {
      await expect(service.findOne(0)).rejects.toThrow(new NotFoundException(ERROR_MESSAGES.embeddableModule.assignmentNotFound))
    });

    it('should return specific embeddable assignment if found', async () => {
      const q = await service.findOne(assignments[0].id);
      expect(q).toEqual(assignments[0]);
    });
  });

  describe('upsert()', () => {
    it('should update an existing assignment', async () => {
      const prev = pick(assignments[2],['criteriaText','questionText','instructions'])
      const result = await service.upsert(course.id, {
        name: 'new name',
        questions: [],
      }, assignments[2].id);
      const retrieve = await EmbeddableAssignmentModel.findOne({
        where: {
          id: assignments[2].id
        }
      });
      const sub = pick(retrieve,['name']);
      expect(sub).not.toEqual(prev);
      expect(sub).toEqual(pick(result,['name']));
    });

    it('should create a non-existing assignment', async () => {
      const result = await service.upsert(course.id, {
        name: 'new name',
        questions: [],
      });
      const retrieve = await EmbeddableAssignmentModel.findOne({ where: { id: result.id }});
      expect(retrieve).toBeDefined();
      expect(pick(retrieve,['name'])).toEqual({
        name: 'new name',
      });
    });

    it('should create questions that do not exist already', async () => {
      const result = await service.upsert(course.id, {
        name: 'name',
        questions: [
          {
            order: 0,
            createParams: {
              questionText: 'question',
              criteriaText: 'criteria',
            },
          },
          {
            order: 1,
            createParams: {
              questionText: 'question',
              criteriaText: 'criteria',
            },
          },
          {
            order: 2,
            createParams: {
              questionText: 'question',
              criteriaText: 'criteria',
            },
          }
        ],
      });

      expect(await EmbeddableAssignmentQuestionModel.find({
        where: {
          assignmentId: result.id,
        }
      })).toHaveLength(3);
    });

    it('should associate existing questions', async () => {
      const question = await EmbeddableQuestionFactory.create()
      const result = await service.upsert(course.id, {
        name: 'name',
        questions: [
          {
            order: 0,
            questionId: question.id,
          },
        ],
      });

      const questions = await EmbeddableAssignmentQuestionModel.find({
        where: {
          assignmentId: result.id,
        },
        relations: {
          question: true,
        }
      });

      expect(questions).toHaveLength(1);
      expect(pick(questions[0].question,['criteriaText','questionText','name'])).toEqual(pick(question,['criteriaText','questionText','name']))
    });

    it('update should delete weak questions when they are no longer included and retain strong ones', async () => {
      const question = await EmbeddableQuestionFactory.create();
      const initial = await service.upsert(course.id, {
        name: 'name',
        questions: [
          {
            order: 0,
            createParams: {
              questionText: 'question',
              criteriaText: 'criteria',
            },
          },
          {
            order: 1,
            questionId: question.id,
          }
        ],
      });

      const questions = await EmbeddableAssignmentQuestionModel.find({
        where: {
          assignmentId: initial.id,
        },
        relations: {
          question: true,
        }
      });
      const weak = questions.find(q => q.question.isWeak === true);

      await service.upsert(course.id, {
        name: 'new name',
        questions: [],
      }, initial.id);

      expect(await EmbeddableQuestionModel.findOne({
        where: {
          id: weak.questionId
        }
      })).toBeFalsy();
      expect(await EmbeddableQuestionModel.findOne({
        where: {
          id: question.id,
        }
      })).toBeTruthy();
      expect(await EmbeddableAssignmentQuestionModel.find({
        where: {
          assignmentId: initial.id,
        }
      })).toHaveLength(0);
    });
  });

  describe('delete()', () => {
    it('should delete a question with given id', async () => {
      await service.delete(assignments[0].id);
      expect(await EmbeddableAssignmentModel.findOne({where: {id: assignments[0].id}})).toBeFalsy();
    });
  });

  describe('getAnswers()', () => {
    it('should retrieve answers for the given embeddable question ID', async () => {
      const assignment = await EmbeddableAssignmentFactory.create();
      const question = await EmbeddableQuestionFactory.create()
      const aq = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      await EmbeddableAssignmentFeedbackFactory.createList(3,{
        assignmentQuestion: aq,
      });
      expect(await service.getAnswers(assignment.id, question.id)).toHaveLength(3);
    });
  });

  describe('updateAnswer()', () => {
    it('should update an answer with the given human feedback and grade', async () => {
      const feedback = await EmbeddableAssignmentFeedbackFactory.create();

      const params = {
        humanFeedback: 'feedback',
        humanGrade: 60,
      }
      await service.updateAnswer(feedback.id, params);

      const retrieve = await EmbeddableAssignmentFeedbackModel.findOne({
        where: {
          id: feedback.id,
        }
      });
      expect(pick(retrieve,['humanFeedback','humanGrade'])).toEqual(params)
    });
  });

  describe('deleteAnswer()', () => {
    it('should delete an answer with the given ID', async () => {
      const feedback = await EmbeddableAssignmentFeedbackFactory.create();
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