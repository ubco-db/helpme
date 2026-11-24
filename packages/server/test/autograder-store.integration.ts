import { Test, type TestingModule } from '@nestjs/testing';
import {
  AUTOGRADER_GRADING_MODE,
  AutograderRunStatus,
  FINAL_GRADING_INSTRUCTION,
} from '@koh/common';
import { TestTypeOrmModule } from './util/testUtils';
import { AutograderStore } from '../src/lti/autograder/autograder.store';
import { AutograderRunModel } from '../src/lti/autograder/autograder-run.entity';
import { CourseModel } from '../src/course/course.entity';

describe('Autograder persistence', () => {
  let module: TestingModule;
  let store: AutograderStore;
  let course: CourseModel;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [TestTypeOrmModule],
      providers: [AutograderStore],
    }).compile();
    store = module.get(AutograderStore);
    course = await CourseModel.create({
      name: 'Autograder test course',
    }).save();
  });
  afterAll(async () => module?.close());

  function runData(canvasQuizId: number): Partial<AutograderRunModel> {
    return {
      courseId: course.id,
      canvasQuizId,
      assignmentId: canvasQuizId + 1000,
      quizTitle: 'Essay quiz',
      status: AutograderRunStatus.Running,
      gradingMode: AUTOGRADER_GRADING_MODE,
      instruction: FINAL_GRADING_INSTRUCTION,
      speedGraderUrl: `https://canvas.test/speed_grader?assignment_id=${canvasQuizId + 1000}`,
      createdByUserId: 1,
      regradeSubmissions: false,
      includePostedGrades: false,
      questionSnapshots: [],
      error: null,
      completedAt: null,
    };
  }

  it('excludes duplicate workers and releases the lock after failure', async () => {
    let executions = 0;
    await expect(
      store.withRunLock(7, async () => {
        executions++;
        await store.withRunLock(7, async () => {
          executions++;
        });
        throw new Error('Worker failed');
      }),
    ).rejects.toThrow('Worker failed');
    expect(executions).toBe(1);
    await store.withRunLock(7, async () => {
      executions++;
    });
    expect(executions).toBe(2);
  });

  it('reuses the single active run for a course and quiz', async () => {
    const first = await store.createActiveRun(runData(100));
    const second = await store.createActiveRun(runData(100));

    expect(second.id).toBe(first.id);
    expect(await AutograderRunModel.countBy({ canvasQuizId: 100 })).toBe(1);
  });

  it('enforces the partial unique index for running runs only', async () => {
    const repository = AutograderRunModel.getRepository();
    const running = await repository.save(repository.create(runData(102)));

    await expect(
      repository.save(repository.create(runData(102))),
    ).rejects.toThrow(/duplicate key/i);
    expect(await AutograderRunModel.countBy({ canvasQuizId: 102 })).toBe(1);

    running.status = AutograderRunStatus.Completed;
    running.completedAt = new Date();
    await repository.save(running);

    await expect(
      repository.save(repository.create(runData(102))),
    ).resolves.toMatchObject({ status: AutograderRunStatus.Running });
  });

  it('resolves concurrent starters to the same active run', async () => {
    const [first, second] = await Promise.all([
      store.createActiveRun(runData(103)),
      store.createActiveRun(runData(103)),
    ]);

    expect(second.id).toBe(first.id);
    expect(await AutograderRunModel.countBy({ canvasQuizId: 103 })).toBe(1);
  });

  it('creates a new run after the previous run completes', async () => {
    const first = await store.createActiveRun(runData(101));
    first.status = AutograderRunStatus.Completed;
    first.completedAt = new Date();
    await store.saveRun(first);

    const second = await store.createActiveRun(runData(101));

    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe(AutograderRunStatus.Running);
    expect(await AutograderRunModel.countBy({ canvasQuizId: 101 })).toBe(2);
  });
});
