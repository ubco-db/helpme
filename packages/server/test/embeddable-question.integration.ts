import { HttpException } from '@nestjs/common';
import { setupIntegrationTest } from './util/testUtils';
import { LtiModule } from '../src/lti/lti.module';
import {
  CourseFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { QuestionGradingSettings, Role } from '@koh/common';
import { EmbeddableQuestionModel } from '../src/lti/embeddable-question/embeddable-question.entity';
import { EmbeddableQuestionFeedbackModel } from '../src/lti/embeddable-question/embeddable-question-feedback.entity';
import { QuestionGradingService } from '../src/lti/embeddable-question/question-grading.service';
import { GradingConstraintError } from '../src/lti/embeddable-question/grading-utils';

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
    rubric,
    feedbackInstructions:
      'Give concise, constructive feedback grounded in the rubric.',
    scoreScale: { max: 10, step: 0.5 },
    checks: [],
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
      humanReviewReason: null,
      gradingSnapshot: {
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
    // The review reason is staff-only state and never part of the student DTO.
    expect(feedbackResponse.body).not.toHaveProperty('humanReviewReason');

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
    expect(feedback.humanReviewReason).toBeNull();
    expect(feedback.gradingSnapshot).toEqual({
      questionText: question.questionText,
      gradingSettings: originalSettings,
    });
  });

  it('persists a human review reason for flagged grades without exposing it to students', async () => {
    const { user, course } = await setupCourseMember(Role.STUDENT);
    const gradingSettings = settings('Grade the answer.');
    const question = await EmbeddableQuestionModel.create({
      courseId: course.id,
      title: 'Ambiguous question',
      questionText: 'Explain the ambiguous requirement.',
      gradingSettings,
    }).save();
    const reason =
      'The rubric can be read as requiring either one or two examples.';
    mockQuestionGradingService.evaluate.mockResolvedValueOnce({
      score: 6,
      comment: 'Hard to judge against the rubric.',
      appliedRequirements: [],
      maxScore: 10,
      model: 'grading-model',
      reasons: ['ambiguous rubric'],
      humanReviewReason: reason,
      gradingSnapshot: {
        questionText: question.questionText,
        gradingSettings,
      },
    });

    const feedbackResponse = await supertest({ userId: user.id })
      .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
      .send({ responseText: 'One example.' })
      .expect(201);

    expect(feedbackResponse.body).toEqual({
      score: 6,
      comment: 'Hard to judge against the rubric.',
      appliedRequirements: [],
      maxScore: 10,
    });
    expect(feedbackResponse.body).not.toHaveProperty('humanReviewReason');

    const feedback = await EmbeddableQuestionFeedbackModel.findOneOrFail({
      where: { questionId: question.id, userId: user.id },
    });
    expect(feedback.humanReviewReason).toBe(reason);
  });

  it('deletes a question and its grading history', async () => {
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
      gradingSnapshot: {
        questionText: 'Keep this history.',
        gradingSettings: settings('Grade the answer.'),
      },
    }).save();

    await supertest({ userId: user.id })
      .delete(`/lti/embeddable-question/${course.id}/${question.id}`)
      .expect(200);
    expect(
      await EmbeddableQuestionModel.findOneBy({ id: question.id }),
    ).toBeNull();
    expect(
      await EmbeddableQuestionFeedbackModel.countBy({
        questionId: question.id,
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

  it.each([
    [
      400,
      'request (5418 tokens) exceeds the available context size (4096 tokens)',
      400,
      'Shorten your answer',
    ],
    [413, 'Request too large', 400, 'Shorten your answer'],
    [400, 'Invalid response format', 503, 'contact your instructor'],
    [401, 'Invalid API key: secret-test-key', 503, 'contact your instructor'],
    [504, 'The chatbot request timed out.', 504, 'took too long'],
    [
      502,
      'The AI did not return a valid structured response.',
      500,
      'Please try again',
    ],
  ])(
    'handles upstream %s without saving a grade',
    async (upstreamStatus, detail, status, message) => {
      const { user, course } = await setupCourseMember(Role.STUDENT);
      const question = await EmbeddableQuestionModel.create({
        courseId: course.id,
        title: 'Feedback failure',
        questionText: 'Explain this.',
        gradingSettings: settings('Grade the answer.'),
      }).save();
      mockQuestionGradingService.evaluate.mockRejectedValueOnce(
        new HttpException(detail, upstreamStatus),
      );
      const response = await supertest({ userId: user.id })
        .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
        .send({ responseText: 'An answer.' })
        .expect(status);
      expect(response.body.message).toContain(message);
      expect(response.body.message).toContain('Your answer was not saved.');
      expect(response.body.message).not.toContain(detail);
      expect(
        await EmbeddableQuestionFeedbackModel.count({
          where: { questionId: question.id },
        }),
      ).toBe(0);
    },
  );

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
