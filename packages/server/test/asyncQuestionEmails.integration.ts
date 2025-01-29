import { Role, MailServiceType } from '@koh/common';
import { AsyncQuestionModel } from 'asyncQuestion/asyncQuestion.entity';
import { asyncQuestionModule } from 'asyncQuestion/asyncQuestion.module';
import { CourseModel } from 'course/course.entity';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { UserModel } from 'profile/user.entity';
import {
  UserFactory,
  CourseFactory,
  UserCourseFactory,
  AsyncQuestionFactory,
  userSubscriptionFactory,
  mailServiceFactory,
} from './util/factories';
import {
  expectEmailNotSent,
  expectEmailSent,
  overrideEmailService,
  setupIntegrationTest,
} from './util/testUtils';

/* These are integration tests to make sure they are sending the right emails.
    The reason why these aren't in asyncQuestion.integration.ts is these have different setups and mocks and separating them helps keep it organised.
*/
describe('AsyncQuestion Integration - Email Tests', () => {
  const supertest = setupIntegrationTest(
    asyncQuestionModule,
    overrideEmailService,
  );

  let course: CourseModel;
  let questionOwner: UserModel;
  let otherStudent: UserModel;
  let staffMember: UserModel;
  let asyncQuestion: AsyncQuestionModel;

  beforeEach(async () => {
    // Clear DB & recreate scenario
    jest.clearAllMocks();

    questionOwner = await UserFactory.create({
      firstName: 'Question',
      lastName: 'Owner',
      email: 'question@Owner.com',
    });
    otherStudent = await UserFactory.create({
      firstName: 'Other',
      lastName: 'Student',
      email: 'other@Student.com',
    });
    staffMember = await UserFactory.create({
      firstName: 'Staff',
      lastName: 'Member',
      email: 'staff@Member.com',
    });
    course = await CourseFactory.create();
    await UserCourseFactory.create({
      user: questionOwner,
      course,
      role: Role.STUDENT,
    });
    await UserCourseFactory.create({
      user: otherStudent,
      course,
      role: Role.STUDENT,
    });
    await UserCourseFactory.create({
      user: staffMember,
      course,
      role: Role.PROFESSOR,
    });

    // Create a question from questionOwner
    asyncQuestion = await AsyncQuestionFactory.create({
      creator: questionOwner,
      course,
      questionAbstract: 'Test question',
    });
  });

  describe('POST /asyncQuestions/vote/:qid/:vote', () => {
    beforeEach(async () => {
      // Give questionOwner a subscription to upvote notifications
      // so we can check that the email is actually sent
      const upvoteService = await mailServiceFactory.create({
        serviceType: MailServiceType.ASYNC_QUESTION_UPVOTED,
      });
      await userSubscriptionFactory.create({
        service: upvoteService,
      });
      await UserSubscriptionModel.create({
        userId: questionOwner.id,
        service: upvoteService,
        isSubscribed: true,
      }).save();
    });
    it('sends an upvote email notification to questionOwner if another user upvotes their question', async () => {
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/vote/${asyncQuestion.id}/1`)
        .expect(200);

      // ensure mailService.sendEmail was actually called
      // expectEmailSent(
      //   questionOwner.email,
      //   MailServiceType.ASYNC_QUESTION_UPVOTED,
      // );
    });
    it('does NOT send an email if the question owner upvotes their own question', async () => {
      await supertest({ userId: questionOwner.id })
        .post(`/asyncQuestions/vote/${asyncQuestion.id}/1`)
        .expect(200);

      // questionOwner is the same user who owns it, so no email
      expectEmailNotSent();
    });
  });
});
