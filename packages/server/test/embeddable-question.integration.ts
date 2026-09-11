import { setupIntegrationTest } from './util/testUtils';
import { LtiModule } from '../src/lti/lti.module';
import {
  CourseFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import {
  createGradingPreset,
  QuestionGradingSettings,
  Role,
} from '@koh/common';
import { EmbeddableQuestionModel } from '../src/lti/embeddable/question/embeddable-question.entity';
import { EmbeddableQuestionFeedbackModel } from '../src/lti/embeddable/question/embeddable-question-feedback.entity';
import { QuestionGradingService } from '../src/lti/embeddable/question/question-grading.service';
import { GradingConstraintError } from '../src/lti/embeddable/question/grading';

describe('Embeddable question grading', () => {
  const mockQuestionGradingService = { evaluate: jest.fn() };
  const { supertest } = setupIntegrationTest(LtiModule, (builder) =>
    builder
      .overrideProvider(QuestionGradingService)
      .useValue(mockQuestionGradingService),
  );

  beforeEach(() => mockQuestionGradingService.evaluate.mockReset());

  const setupCourseMember = async (role: Role) => {
    const user = await UserFactory.create();
    const course = await CourseFactory.create();
    await UserCourseFactory.create({ user, course, role });
    return { user, course };
  };

  const settings = (rubric: string): QuestionGradingSettings => ({
    ...createGradingPreset('generic'),
    rubric,
    scoreScale: { max: 10, step: 0.5 },
  });

  it('lets staff create a question with question-owned grading settings', async () => {
    const { user, course } = await setupCourseMember(Role.PROFESSOR);
    const gradingSettings = settings('Award points for a correct explanation.');

    const response = await supertest({ userId: user.id })
      .post(`/lti/embeddable-question/${course.id}`)
      .send({
        title: 'Explain the concept',
        questionText: 'Explain the concept in your own words.',
        gradingSettings,
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        title: 'Explain the concept',
        questionText: 'Explain the concept in your own words.',
        gradingSettings,
      }),
    );
    expect(response.body.gradingSettings.scoreScale).toEqual({
      max: 10,
      step: 0.5,
    });
  });

  it('rejects illegal score caps and duplicate checks on create', async () => {
    const { user, course } = await setupCourseMember(Role.PROFESSOR);

    await supertest({ userId: user.id })
      .post(`/lti/embeddable-question/${course.id}`)
      .send({
        title: 'Bad cap',
        questionText: 'This must be rejected.',
        gradingSettings: {
          ...settings('Grade the answer.'),
          checks: [{ kind: 'minimum_sentences', minimum: 3, scoreCap: 7.25 }],
        },
      })
      .expect(400);

    await supertest({ userId: user.id })
      .post(`/lti/embeddable-question/${course.id}`)
      .send({
        title: 'Duplicate checks',
        questionText: 'This must be rejected.',
        gradingSettings: {
          ...settings('Grade the answer.'),
          checks: [
            { kind: 'minimum_sentences', minimum: 3, scoreCap: 1 },
            { kind: 'minimum_sentences', minimum: 4, scoreCap: 1 },
          ],
        },
      })
      .expect(400);
  });

  it('exposes only the student-facing question fields', async () => {
    const { user, course } = await setupCourseMember(Role.STUDENT);
    const question = await EmbeddableQuestionModel.create({
      courseId: course.id,
      title: 'Evidence question',
      questionText: 'What evidence supports the claim?',
      gradingSettings: settings('Use evidence from the source.'),
    }).save();

    const response = await supertest({ userId: user.id })
      .get(`/lti/embeddable-question/${course.id}/${question.id}`)
      .expect(200);

    expect(response.body).toEqual({
      id: question.id,
      courseId: course.id,
      questionText: question.questionText,
    });
    expect(response.body).not.toHaveProperty('gradingSettings');
    expect(response.body).not.toHaveProperty('rubric');
  });

  it('preserves the exact grading snapshot after edits', async () => {
    const { user, course } = await setupCourseMember(Role.STUDENT);
    const originalSettings = settings('Award points for relevant evidence.');
    const question = await EmbeddableQuestionModel.create({
      courseId: course.id,
      title: 'Evidence question',
      questionText: 'Which evidence supports the claim?',
      gradingSettings: originalSettings,
    }).save();
    const submission =
      'The article supports the claim with a measured comparison.';
    mockQuestionGradingService.evaluate.mockResolvedValue({
      score: 8,
      comment: 'The evidence is relevant.',
      appliedRequirements: [],
      maxScore: 10,
      model: 'grading-model',
      reasons: ['too_short'],
      needsHumanReview: false,
      gradingSnapshot: {
        version: 1,
        questionText: question.questionText,
        gradingSettings: originalSettings,
      },
    });

    const feedbackResponse = await supertest({ userId: user.id })
      .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
      .send({ responseText: submission })
      .expect(201);

    expect(feedbackResponse.body).toEqual({
      score: 8,
      comment: 'The evidence is relevant.',
      appliedRequirements: [],
      maxScore: 10,
    });
    expect(feedbackResponse.body).not.toHaveProperty('model');
    expect(feedbackResponse.body).not.toHaveProperty('gradingSnapshot');

    expect(mockQuestionGradingService.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: course.id,
        questionText: question.questionText,
        submission,
      }),
    );

    await EmbeddableQuestionModel.update(
      { id: question.id, courseId: course.id },
      { gradingSettings: settings('A changed rubric.') },
    );
    const feedback = await EmbeddableQuestionFeedbackModel.findOneOrFail({
      where: { questionId: question.id, userId: user.id },
    });

    expect(feedback.maxScore).toBe(10);
    expect(feedback.aiModel).toBe('grading-model');
    expect(feedback.reasons).toEqual(['too_short']);
    expect(feedback.needsHumanReview).toBe(false);
    expect(feedback.gradingSnapshot).toEqual({
      version: 1,
      questionText: question.questionText,
      gradingSettings: originalSettings,
    });
  });

  it('refuses to delete questions that contain grading history', async () => {
    const { user, course } = await setupCourseMember(Role.PROFESSOR);
    const question = await EmbeddableQuestionModel.create({
      courseId: course.id,
      title: 'Protected question',
      questionText: 'Keep this history.',
      gradingSettings: settings('Grade the answer.'),
    }).save();
    await EmbeddableQuestionFeedbackModel.create({
      courseId: course.id,
      questionId: question.id,
      userId: user.id,
      submission: 'An earlier answer.',
      aiFeedback: 'Saved feedback.',
      aiGrade: 5,
      appliedRequirements: [],
      aiModel: 'grading-model',
      maxScore: 10,
      gradingSnapshot: null,
    }).save();

    await supertest({ userId: user.id })
      .delete(`/lti/embeddable-question/${course.id}/${question.id}`)
      .expect(409);
  });

  it('duplicates a question through the create endpoint without touching the original', async () => {
    const { user, course } = await setupCourseMember(Role.PROFESSOR);
    const originalSettings = settings(
      'Original rubric, used only by the original question.',
    );
    const original = await EmbeddableQuestionModel.create({
      courseId: course.id,
      title: 'Original question',
      questionText: 'Answer the prompt in your own words.',
      gradingSettings: originalSettings,
    }).save();
    await EmbeddableQuestionFeedbackModel.create({
      courseId: course.id,
      questionId: original.id,
      userId: user.id,
      submission: 'An earlier answer.',
      aiFeedback: 'History kept on the original.',
      aiGrade: 2,
      appliedRequirements: ['Answered in complete sentences.'],
      aiModel: 'grading-model',
      maxScore: 10,
      gradingSnapshot: null,
    }).save();

    // The frontend duplicates via the existing create endpoint, copying only
    // title/questionText/settings.
    const copyResponse = await supertest({ userId: user.id })
      .post(`/lti/embeddable-question/${course.id}`)
      .send({
        title: 'Original question (copy)',
        questionText: 'Answer the prompt in your own words.',
        gradingSettings: structuredClone(originalSettings),
      })
      .expect(201);
    expect(copyResponse.body.id).not.toBe(original.id);

    // Editing the copy must not affect the original.
    const copySettings = settings('Copy-only rubric.');
    await supertest({ userId: user.id })
      .patch(`/lti/embeddable-question/${course.id}/${copyResponse.body.id}`)
      .send({
        title: 'Renamed copy',
        questionText: 'Answer the prompt in your own words.',
        gradingSettings: copySettings,
      })
      .expect(200);

    const reloadedOriginal = await EmbeddableQuestionModel.findOneOrFail({
      where: { id: original.id, courseId: course.id },
    });
    expect(reloadedOriginal.title).toBe('Original question');
    expect(reloadedOriginal.gradingSettings).toEqual(originalSettings);

    const originalHistory = await EmbeddableQuestionFeedbackModel.find({
      where: { questionId: original.id },
    });
    expect(originalHistory).toHaveLength(1);
    expect(originalHistory[0].aiFeedback).toBe('History kept on the original.');

    const copy = await EmbeddableQuestionModel.findOneOrFail({
      where: { id: copyResponse.body.id, courseId: course.id },
    });
    expect(copy.title).toBe('Renamed copy');
    expect(copy.gradingSettings).toEqual(copySettings);
    expect(
      await EmbeddableQuestionFeedbackModel.count({
        where: { questionId: copy.id },
      }),
    ).toBe(0);
  });

  it('persists nothing when grading fails', async () => {
    const { user, course } = await setupCourseMember(Role.STUDENT);
    const question = await EmbeddableQuestionModel.create({
      courseId: course.id,
      title: 'Failing question',
      questionText: 'This evaluation will fail.',
      gradingSettings: settings('Grade the answer.'),
    }).save();
    mockQuestionGradingService.evaluate.mockRejectedValueOnce(
      new GradingConstraintError('The grader returned an invalid grade.'),
    );

    await supertest({ userId: user.id })
      .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
      .send({ responseText: 'An answer that cannot be graded.' })
      .expect(500);

    expect(
      await EmbeddableQuestionFeedbackModel.count({
        where: { questionId: question.id },
      }),
    ).toBe(0);
  });

  it('rejects invalid feedback bodies and question configurations without grading or persisting', async () => {
    const course = await CourseFactory.create();
    const student = await UserFactory.create();
    const professor = await UserFactory.create();
    await UserCourseFactory.create({
      user: student,
      course,
      role: Role.STUDENT,
    });
    await UserCourseFactory.create({
      user: professor,
      course,
      role: Role.PROFESSOR,
    });
    const question = await EmbeddableQuestionModel.create({
      courseId: course.id,
      title: 'Validation question',
      questionText: 'Answer this.',
      gradingSettings: settings('Grade the answer.'),
    }).save();

    // Whitespace feedback fails the request DTO before grading runs.
    await supertest({ userId: student.id })
      .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
      .send({ responseText: '   ' })
      .expect(400);

    // A blank rubric fails the shared grading-settings validator.
    await supertest({ userId: professor.id })
      .post(`/lti/embeddable-question/${course.id}`)
      .send({
        title: 'No rubric',
        questionText: 'This must be rejected.',
        gradingSettings: settings('   '),
      })
      .expect(400);

    // The nested cross-field rule applies at the HTTP boundary too: a
    // minimum sentence count above the maximum is rejected.
    await supertest({ userId: professor.id })
      .post(`/lti/embeddable-question/${course.id}`)
      .send({
        title: 'Crossed sentence bounds',
        questionText: 'This must be rejected.',
        gradingSettings: {
          ...settings('Grade the answer.'),
          checks: [
            { kind: 'minimum_sentences', minimum: 5, scoreCap: 1 },
            { kind: 'maximum_sentences', maximum: 3, scoreCap: 1 },
          ],
        },
      })
      .expect(400);

    expect(mockQuestionGradingService.evaluate).not.toHaveBeenCalled();
    expect(
      await EmbeddableQuestionFeedbackModel.count({
        where: { questionId: question.id },
      }),
    ).toBe(0);
    expect(
      await EmbeddableQuestionModel.count({
        where: { courseId: course.id, title: 'No rubric' },
      }),
    ).toBe(0);
    expect(
      await EmbeddableQuestionModel.count({
        where: { courseId: course.id, title: 'Crossed sentence bounds' },
      }),
    ).toBe(0);
  });
});
