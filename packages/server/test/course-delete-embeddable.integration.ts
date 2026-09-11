import { OrganizationModule } from 'organization/organization.module';
import { LtiModule } from '../src/lti/lti.module';
import { setupIntegrationTest } from './util/testUtils';
import {
  CourseFactory,
  OrganizationFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import { CourseModel } from 'course/course.entity';
import { OrganizationRole, Role } from '@koh/common';
import { EmbeddableQuestionModel } from '../src/lti/embeddable/question/embeddable-question.entity';
import { EmbeddableQuestionFeedbackModel } from '../src/lti/embeddable/question/embeddable-question-feedback.entity';

describe('Organization course deletion with embeddable content', () => {
  const { supertest } = setupIntegrationTest(OrganizationModule, undefined, [
    LtiModule,
  ]);

  const gradingSettings = {
    rubric: 'Grade the answer against the rubric.',
    feedbackInstructions: '',
    scoreScale: { max: 2, step: 1 },
    checks: [
      { kind: 'minimum_sentences' as const, minimum: 3, scoreCap: null },
      { kind: 'maximum_sentences' as const, maximum: 8, scoreCap: null },
    ],
  };

  it('deletes a course with its questions and feedback, but keeps direct deletion protection', async () => {
    const user = await UserFactory.create();
    const organization = await OrganizationFactory.create();
    const course = await CourseFactory.create();
    await UserCourseFactory.create({ user, course, role: Role.PROFESSOR });
    await OrganizationUserModel.create({
      userId: user.id,
      organizationId: organization.id,
      role: OrganizationRole.ADMIN,
    }).save();
    await OrganizationCourseModel.create({
      courseId: course.id,
      organizationId: organization.id,
    }).save();

    const question = await EmbeddableQuestionModel.create({
      courseId: course.id,
      title: 'Deletable question',
      questionText: 'What is being tested?',
      gradingSettings,
    }).save();
    const feedbackBase = {
      courseId: course.id,
      questionId: question.id,
      userId: user.id,
      submission: 'An answer.',
      aiFeedback: 'Feedback.',
      aiGrade: 2,
      maxScore: 2,
      gradingSnapshot: {
        questionText: 'What is being tested?',
        gradingSettings,
      },
    };
    await EmbeddableQuestionFeedbackModel.create({
      ...feedbackBase,
      appliedRequirements: [],
    }).save();

    await supertest({ userId: user.id })
      .delete(`/lti/embeddable-question/${course.id}/${question.id}`)
      .expect(409);

    await supertest({ userId: user.id })
      .delete(`/organization/${organization.id}/delete_course/${course.id}`)
      .expect(200);

    expect(
      await EmbeddableQuestionFeedbackModel.count({
        where: { courseId: course.id },
      }),
    ).toBe(0);
    expect(
      await EmbeddableQuestionModel.count({ where: { courseId: course.id } }),
    ).toBe(0);
    expect(await CourseModel.count({ where: { id: course.id } })).toBe(0);
  });
});
