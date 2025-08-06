import { asyncQuestionStatus, MailServiceType, Role } from '@koh/common';
import { AsyncQuestionModel } from 'asyncQuestion/asyncQuestion.entity';
import { asyncQuestionModule } from 'asyncQuestion/asyncQuestion.module';
import { CourseModel } from 'course/course.entity';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { UserModel } from 'profile/user.entity';
import {
  AsyncQuestionCommentFactory,
  AsyncQuestionFactory,
  CourseFactory,
  mailServiceFactory,
  SentEmailFactory,
  UserCourseFactory,
  UserFactory,
  userSubscriptionFactory,
} from './util/factories';
import {
  expectEmailNotSent,
  expectEmailSent,
  overrideEmailService,
  setupIntegrationTest,
} from './util/testUtils';
import { MailServiceModel } from 'mail/mail-services.entity';

/* These are integration tests to make sure they are sending the right emails.
    The reason why these aren't in asyncQuestion.integration.ts is these have different setups and mocks and separating them helps keep it organised.
*/
describe('AsyncQuestion Integration - Email Tests', () => {
  const { supertest } = setupIntegrationTest(
    asyncQuestionModule,
    overrideEmailService,
  );

  let course: CourseModel;
  let questionOwner: UserModel;
  let otherStudent: UserModel;
  let staffMember: UserModel;
  let asyncQuestion: AsyncQuestionModel;

  let course2: CourseModel;
  let course2Student: UserModel;
  let course2Staff: UserModel;

  // All mail services
  let upvoteService: MailServiceModel;
  let needsAttentionService: MailServiceModel;
  let humanAnsweredService: MailServiceModel;
  let genericStatusChangedService: MailServiceModel;
  let newCommentMyPostService: MailServiceModel;
  let newCommentOtherPostService: MailServiceModel;

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

    // create all of the services
    upvoteService = await mailServiceFactory.create({
      serviceType: MailServiceType.ASYNC_QUESTION_UPVOTED,
    });
    needsAttentionService = await mailServiceFactory.create({
      serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
    });
    humanAnsweredService = await mailServiceFactory.create({
      serviceType: MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
    });
    genericStatusChangedService = await mailServiceFactory.create({
      serviceType: MailServiceType.ASYNC_QUESTION_STATUS_CHANGED,
    });
    newCommentMyPostService = await mailServiceFactory.create({
      serviceType: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_MY_POST,
    });
    newCommentOtherPostService = await mailServiceFactory.create({
      serviceType: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
    });

    // create a second course with another staff and student
    course2 = await CourseFactory.create();
    course2Student = await UserFactory.create({
      firstName: 'Course2',
      lastName: 'Student',
      email: 'course2@student.com',
    });
    course2Staff = await UserFactory.create({
      firstName: 'Course2',
      lastName: 'Staff',
      email: 'course2@staff.com',
    });
    await UserCourseFactory.create({
      user: course2Student,
      course: course2,
      role: Role.STUDENT,
    });
    await UserCourseFactory.create({
      user: course2Staff,
      course: course2,
      role: Role.PROFESSOR,
    });
    // subscribe them to all notifications (they shouldn't ever get any) - I guess you could call this a big blanket test
    await Promise.all([
      // student
      userSubscriptionFactory.create({
        user: course2Student,
        service: upvoteService,
      }),
      userSubscriptionFactory.create({
        user: course2Student,
        service: needsAttentionService,
      }),
      userSubscriptionFactory.create({
        user: course2Student,
        service: humanAnsweredService,
      }),
      userSubscriptionFactory.create({
        user: course2Student,
        service: genericStatusChangedService,
      }),
      userSubscriptionFactory.create({
        user: course2Student,
        service: newCommentMyPostService,
      }),
      userSubscriptionFactory.create({
        user: course2Student,
        service: newCommentOtherPostService,
      }),
      // staff
      userSubscriptionFactory.create({
        user: course2Staff,
        service: upvoteService,
      }),
      userSubscriptionFactory.create({
        user: course2Staff,
        service: needsAttentionService,
      }),
      userSubscriptionFactory.create({
        user: course2Staff,
        service: humanAnsweredService,
      }),
      userSubscriptionFactory.create({
        user: course2Staff,
        service: genericStatusChangedService,
      }),
      userSubscriptionFactory.create({
        user: course2Staff,
        service: newCommentMyPostService,
      }),
      userSubscriptionFactory.create({
        user: course2Staff,
        service: newCommentOtherPostService,
      }),
    ]);
  });

  describe('POST /asyncQuestions/vote/:qid/:vote', () => {
    let ownerSubscription: UserSubscriptionModel;
    beforeEach(async () => {
      // Give questionOwner a subscription to upvote notifications
      ownerSubscription = await userSubscriptionFactory.create({
        user: questionOwner,
        service: upvoteService,
      });
    });
    it('sends an upvote email notification to questionOwner if another user upvotes their question', async () => {
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/vote/${asyncQuestion.id}/1`)
        .expect(200);

      // ensure mailService.sendEmail was actually called
      expectEmailSent(
        [questionOwner.email],
        [MailServiceType.ASYNC_QUESTION_UPVOTED],
      );
    });
    it('does NOT send an email if the question owner upvotes their own question', async () => {
      await supertest({ userId: questionOwner.id })
        .post(`/asyncQuestions/vote/${asyncQuestion.id}/1`)
        .expect(200);

      // questionOwner is the same user who owns it, so no email
      expectEmailNotSent();
    });
    it('does NOT send an email if the vote is a downvote or 0 (neutral)', async () => {
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/vote/${asyncQuestion.id}/0`)
        .expect(200);

      // vote is neutral, so no email
      expectEmailNotSent();

      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/vote/${asyncQuestion.id}/-1`)
        .expect(200);

      // vote is downvote, so no email
      expectEmailNotSent();
    });
    it('does NOT send an email if the question owner is not subscribed to upvote notifications', async () => {
      // unsubscribe questionOwner from upvote notifications
      ownerSubscription.isSubscribed = false;
      await ownerSubscription.save();

      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/vote/${asyncQuestion.id}/1`)
        .expect(200);

      // questionOwner is not subscribed, so no email
      expectEmailNotSent();
    });
    it('does NOT send an email if the vote is an invalid number (like 999)', async () => {
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/vote/${asyncQuestion.id}/999`)
        .expect(400);

      // vote is invalid, so no email
      expectEmailNotSent();
    });
    it('does NOT send an email to otherUser if they are also subscribed to upvote notifications', async () => {
      // subscribe otherStudent to upvote notifications
      await UserSubscriptionModel.create({
        userId: otherStudent.id,
        service: upvoteService,
        isSubscribed: true,
      }).save();

      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/vote/${asyncQuestion.id}/1`)
        .expect(200);

      // only 1 email is sent, and that's to questionOwner, and not to the other student
      expectEmailSent(
        [questionOwner.email],
        [MailServiceType.ASYNC_QUESTION_UPVOTED],
      );
    });
  });

  describe('PATCH /asyncQuestions/student/:questionId', () => {
    let staffSubscription: UserSubscriptionModel;
    beforeEach(async () => {
      // Give staffmember a subscription to needs attention email
      staffSubscription = await userSubscriptionFactory.create({
        user: staffMember,
        service: needsAttentionService,
      });
    });
    it('sends an email to staffMember when a student flags a question as needs attention', async () => {
      await supertest({ userId: questionOwner.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnsweredNeedsAttention })
        .expect(200);

      // ensure mailService.sendEmail was actually called
      expectEmailSent(
        [[staffMember.email]],
        [MailServiceType.ASYNC_QUESTION_FLAGGED],
      );
    });
    it('sends an email to all staffMembers that are subscribed when a student flags a question as needs attention', async () => {
      // set up other staff member
      const otherStaffMember = await UserFactory.create({
        firstName: 'Other',
        lastName: 'Staff',
        email: 'Other@Staff.com',
      });
      await UserCourseFactory.create({
        user: otherStaffMember,
        course,
        role: Role.PROFESSOR,
      });
      await UserSubscriptionModel.create({
        userId: otherStaffMember.id,
        service: needsAttentionService,
        isSubscribed: true,
      }).save();
      // call endpoint
      await supertest({ userId: questionOwner.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnsweredNeedsAttention })
        .expect(200);
      // checks
      expectEmailSent(
        [[staffMember.email, otherStaffMember.email]],
        [
          MailServiceType.ASYNC_QUESTION_FLAGGED,
          MailServiceType.ASYNC_QUESTION_FLAGGED,
        ],
      );
    });
    it('does NOT send an email for all other statuses', async () => {
      await supertest({ userId: questionOwner.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnswered })
        .expect(200);
      expectEmailNotSent();
      await supertest({ userId: questionOwner.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnsweredResolved })
        .expect(200);
      expectEmailNotSent();
      await supertest({ userId: questionOwner.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.HumanAnswered })
        .expect(403);
      expectEmailNotSent();
      await supertest({ userId: questionOwner.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.StudentDeleted })
        .expect(200);
      expectEmailNotSent();
      await supertest({ userId: questionOwner.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.TADeleted })
        .expect(403);
      expectEmailNotSent();
    });
    it('does NOT send an email if the question is invalid', async () => {
      await supertest({ userId: questionOwner.id })
        .patch(`/asyncQuestions/student/999`)
        .send({ status: asyncQuestionStatus.AIAnsweredNeedsAttention })
        .expect(404);
      expectEmailNotSent();
    });
    it('does NOT send an email for unauthorized users', async () => {
      await supertest()
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnsweredNeedsAttention })
        .expect(401);
      expectEmailNotSent();
    });
    it('does NOT send an email if the staff member is not subscribed', async () => {
      staffSubscription.isSubscribed = false;
      await staffSubscription.save();
      await supertest({ userId: questionOwner.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnsweredNeedsAttention })
        .expect(200);
      expectEmailNotSent();
    });
    it('does NOT send an email for other student even if they are subscribed (receiver must be staff)', async () => {
      await UserSubscriptionModel.create({
        userId: otherStudent.id,
        service: needsAttentionService,
        isSubscribed: true,
      }).save();
      await supertest({ userId: questionOwner.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnsweredNeedsAttention })
        .expect(200);
      // only 1 email is sent, and that's to staffMember, and not to the other student
      expectEmailSent(
        [[staffMember.email]],
        [MailServiceType.ASYNC_QUESTION_FLAGGED],
      );
    });
  });
  describe('PATCH /asyncQuestions/faculty/:questionId HumanAnswered', () => {
    let humanAnsweredSubscription: UserSubscriptionModel;
    beforeEach(async () => {
      // give questionOwner a subscription to ASYNC_QUESTION_HUMAN_ANSWERED
      humanAnsweredSubscription = await userSubscriptionFactory.create({
        user: questionOwner,
        service: humanAnsweredService,
      });
    });
    it('sends an email to questionOwner when a staff makes their question HumanAnswered', async () => {
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.HumanAnswered })
        .expect(200);

      expectEmailSent(
        [questionOwner.email],
        [MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED],
      );
    });
    it('sends a reply email to original NeedsFeedback email when a staff makes the question HumanAnswered', async () => {
      await SentEmailFactory.create({
        subject: 'Question Needs Feedback',
        accepted: [staffMember.email],
        serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
        metadata: { asyncQuestionId: asyncQuestion.id },
      });
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.HumanAnswered })
        .expect(200);

      expectEmailSent(
        [questionOwner.email, [staffMember.email]],
        [
          MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
          MailServiceType.ASYNC_QUESTION_FLAGGED,
        ],
      );
    });
    it('does NOT send an email for otherStudent if they are subscribed', async () => {
      await UserSubscriptionModel.create({
        userId: otherStudent.id,
        service: humanAnsweredService,
        isSubscribed: true,
      }).save();
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.HumanAnswered })
        .expect(200);

      // only 1 email is sent, and that's to question owner, and not to the other student
      expectEmailSent(
        [questionOwner.email],
        [MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED],
      );
    });
    it('does NOT send an email to questionOwner if they are not subscribed', async () => {
      humanAnsweredSubscription.isSubscribed = false;
      await humanAnsweredSubscription.save();
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.HumanAnswered })
        .expect(200);

      expectEmailNotSent();
    });
    it('does NOT send this email for other statuses', async () => {
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnswered })
        .expect(200);
      expectEmailNotSent();
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnsweredNeedsAttention })
        .expect(200);
      expectEmailNotSent();
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnsweredResolved })
        .expect(200);
      expectEmailNotSent();
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.StudentDeleted })
        .expect(200);
      expectEmailNotSent();
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.TADeleted })
        .expect(200);
      expectEmailNotSent();
    });
  });
  describe('PATCH /asyncQuestions/faculty/:questionId StatusChanged', () => {
    let statusChangedSubscription: UserSubscriptionModel;
    beforeEach(async () => {
      // give questionOwner a subscription to ASYNC_QUESTION_STATUS_CHANGED
      statusChangedSubscription = await userSubscriptionFactory.create({
        user: questionOwner,
        service: genericStatusChangedService,
      });
    });
    it('sends an email to questionOwner when a staff changes the status of their question to most statuses', async () => {
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnswered })
        .expect(200);
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnsweredResolved })
        .expect(200);
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnsweredNeedsAttention })
        .expect(200);

      expectEmailSent(
        [questionOwner.email, questionOwner.email, questionOwner.email],
        [
          MailServiceType.ASYNC_QUESTION_STATUS_CHANGED,
          MailServiceType.ASYNC_QUESTION_STATUS_CHANGED,
          MailServiceType.ASYNC_QUESTION_STATUS_CHANGED,
        ],
      );
    });
    it('does NOT send an email for other statuses (especially delete)', async () => {
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.HumanAnswered })
        .expect(200);
      expectEmailNotSent();
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.StudentDeleted })
        .expect(200);
      expectEmailNotSent();
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.TADeleted })
        .expect(200);
      expectEmailNotSent();
    });
    it('does NOT send an email to questionOwner if they are not subscribed', async () => {
      statusChangedSubscription.isSubscribed = false;
      await statusChangedSubscription.save();
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnswered })
        .expect(200);

      expectEmailNotSent();
    });
    it('does NOT send an email to other student if they are subscribed', async () => {
      await UserSubscriptionModel.create({
        userId: otherStudent.id,
        service: genericStatusChangedService,
        isSubscribed: true,
      }).save();
      await supertest({ userId: staffMember.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({ status: asyncQuestionStatus.AIAnswered })
        .expect(200);

      // only 1 email is sent, and that's to question owner, and not to the other student
      expectEmailSent(
        [questionOwner.email],
        [MailServiceType.ASYNC_QUESTION_STATUS_CHANGED],
      );
    });
  });
  describe('POST /asyncQuestions/comment/:qid NewCommentMyPost', () => {
    let ownerSubscription: UserSubscriptionModel;
    beforeEach(async () => {
      // Give questionOwner a subscription to newCommentMyPostService
      ownerSubscription = await userSubscriptionFactory.create({
        user: questionOwner,
        service: newCommentMyPostService,
      });
    });
    it('sends an email to questionOwner when another user comments on their post', async () => {
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Test comment' })
        .expect(201);

      expectEmailSent(
        [questionOwner.email],
        [MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_MY_POST],
      );
    });
    it('does NOT send an email to questionOwner if they are not subscribed', async () => {
      ownerSubscription.isSubscribed = false;
      await ownerSubscription.save();
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Test comment' })
        .expect(201);

      expectEmailNotSent();
    });
    it('does NOT send an email to questionOwner if they are the one commenting', async () => {
      await supertest({ userId: questionOwner.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Test comment' })
        .expect(201);

      expectEmailNotSent();
    });
    it('does NOT send an email to questionOwner if the question is invalid', async () => {
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/comment/999`)
        .send({ commentText: 'Test comment' })
        .expect(404);

      expectEmailNotSent();
    });
    it('does NOT send an email for unauthorized users', async () => {
      await supertest()
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Test comment' })
        .expect(401);

      expectEmailNotSent();
    });
    it('does NOT send an email to otherStudent if they are subscribed', async () => {
      await UserSubscriptionModel.create({
        userId: otherStudent.id,
        service: newCommentMyPostService,
        isSubscribed: true,
      }).save();
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Test comment' })
        .expect(201);

      // only 1 email is sent, and that's to question owner, and not to the other student
      expectEmailSent(
        [questionOwner.email],
        [MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_MY_POST],
      );
    });
    it('does NOT send an email for invalid comment bodies', async () => {
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ invalidAttribute: '' })
        .expect(400);

      expectEmailNotSent();
    });
  });
  describe('POST /asyncQuestions/comment/:qid NewCommentOthersPost', () => {
    let otherStudentSubscription: UserSubscriptionModel;
    beforeEach(async () => {
      // Make a new comment from otherStudent (questionOwner will create a new comment and we will check if otherStudent got the email)
      await AsyncQuestionCommentFactory.create({
        creator: otherStudent,
        question: asyncQuestion,
        commentText: 'The answer is really quite shrimple',
      });
      // Give otherStudent a subscription to newCommentOtherPostService
      otherStudentSubscription = await userSubscriptionFactory.create({
        user: otherStudent,
        service: newCommentOtherPostService,
      });
    });
    it('sends an email to otherStudent when another user comments on a post they commented on', async () => {
      await supertest({ userId: questionOwner.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Owner Comment!' })
        .expect(201);

      expectEmailSent(
        [otherStudent.email],
        [MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST],
      );
    });
    it('does NOT send an email to otherStudent if they are not subscribed', async () => {
      otherStudentSubscription.isSubscribed = false;
      await otherStudentSubscription.save();
      await supertest({ userId: questionOwner.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Owner Comment!' })
        .expect(201);

      expectEmailNotSent();
    });
    it('does NOT send an email to otherStudent if they are the one commenting', async () => {
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Other student Comment!' })
        .expect(201);

      expectEmailNotSent();
    });
    it('does NOT send an email to otherStudent if the question is invalid', async () => {
      await supertest({ userId: otherStudent.id })
        .post(`/asyncQuestions/comment/999`)
        .send({ commentText: 'Test comment' })
        .expect(404);

      expectEmailNotSent();
    });
    it('does NOT send an email for unauthorized users', async () => {
      await supertest()
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Test comment' })
        .expect(401);

      expectEmailNotSent();
    });
    it('does NOT send an email to questionOwner if they are subscribed', async () => {
      await UserSubscriptionModel.create({
        userId: questionOwner.id,
        service: newCommentOtherPostService,
        isSubscribed: true,
      }).save();
      await supertest({ userId: questionOwner.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Owner Comment!' })
        .expect(201);

      // only 1 email is sent, and that's to otherStudent, and not to the question owner
      expectEmailSent(
        [otherStudent.email],
        [MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST],
      );
    });
    it('does NOT send an email for invalid comment bodies', async () => {
      await supertest({ userId: questionOwner.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ invalidAttribute: '' })
        .expect(400);

      expectEmailNotSent();
    });
    it('Will send only 1 email even if otherStudent has 2 comments on the same post', async () => {
      await AsyncQuestionCommentFactory.create({
        creator: otherStudent,
        question: asyncQuestion,
        commentText: 'Cargo space? No car go road',
      });
      await supertest({ userId: questionOwner.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Owner Comment!' })
        .expect(201);

      expectEmailSent(
        [otherStudent.email],
        [MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST],
      );
    });
    it('Will send an email to multiple students if they have commented on the same post', async () => {
      const otherStudent2 = await UserFactory.create({
        firstName: 'Other2',
        lastName: 'Student',
        email: 'other@Student2.com',
      });
      await UserCourseFactory.create({
        user: otherStudent2,
        course,
        role: Role.STUDENT,
      });
      await AsyncQuestionCommentFactory.create({
        creator: otherStudent2,
        question: asyncQuestion,
        commentText:
          'Nothing ever happens (except these tests failing apparently)',
      });
      await UserSubscriptionModel.create({
        userId: otherStudent2.id,
        service: newCommentOtherPostService,
        isSubscribed: true,
      }).save();
      await supertest({ userId: questionOwner.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({ commentText: 'Owner Comment!' })
        .expect(201);

      expectEmailSent(
        [otherStudent.email, otherStudent2.email],
        [
          MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
          MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
        ],
      );
    });
  });
});
