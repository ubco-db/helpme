import { Test, TestingModule } from '@nestjs/testing'
import { TestConfigModule, TestTypeOrmModule } from '../../../../test/util/testUtils'
import { FactoryModule } from '../../../factory/factory.module'
import { DataSource } from 'typeorm'
import { FactoryService } from '../../../factory/factory.service'
import { CourseFactory, EmbeddableQuestionFactory, initFactoriesFromService } from '../../../../test/util/factories'
import { EmbeddableQuestionService } from './embeddable-question.service'
import { CourseModel } from '../../../course/course.entity'
import { EmbeddableQuestionModel } from './embeddable-question.entity'
import { NotFoundException } from '@nestjs/common'
import { ERROR_MESSAGES } from '@koh/common'
import { pick } from 'lodash'

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
      ],
      providers: [EmbeddableQuestionService],
    }).compile();

    service = module.get<EmbeddableQuestionService>(EmbeddableQuestionService);
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

  describe('findAllForCourse()', () => {
    it('should return all embeddable questions for a given course', async () => {
      const qs = await service.findAllForCourse(course.id);
      expect(qs).toEqual(questions);
    });
  });

  describe('findOne()', () => {
    it('should throw an error if question is not found', async () => {
      await expect(service.findOne(0)).rejects.toThrow(new NotFoundException(ERROR_MESSAGES.embeddableQuestionController.notFound))
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
});