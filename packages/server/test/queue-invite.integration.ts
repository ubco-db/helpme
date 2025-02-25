import { encodeBase64, QueueInviteParams } from '@koh/common';
import { QueueModule } from '../src/queue/queue.module';
import {
  CourseFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  QueueFactory,
  QueueInviteFactory,
  StudentCourseFactory,
  TACourseFactory,
  UserFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { QueueInviteModel } from 'queue/queue-invite.entity';

describe('Queue Invite Integration', () => {
  const { supertest, getTestModule } = setupIntegrationTest(QueueModule);

  describe('POST /queueInvites/:id', () => {
    it('returns 401 when the user is not logged in', async () => {
      await supertest().post(`/queueInvites/1`).expect(401);
    });
    it('Creates a QueueInvite entity for the queue', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });

      await supertest({ userId: ta.userId })
        .post(`/queueInvites/${queue.id}`)
        .expect(201);

      const invite = await QueueInviteModel.findOne({
        queueId: queue.id,
      });
      expect(invite).toBeTruthy();
      expect(invite.queueId).toEqual(queue.id);
    });
    it('Does not allow students to create invites', async () => {
      const course = await CourseFactory.create();
      const stu = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });

      await supertest({ userId: stu.userId })
        .post(`/queueInvites/${queue.id}`)
        .expect(403);
    });
    it('Does not allow creating invites for non-existent queues', async () => {
      const ta = await TACourseFactory.create({
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .post(`/queueInvites/999`)
        .expect(404);
    });
    it('Only allows a queue to have a single invite', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });

      await supertest({ userId: ta.userId }).post(`/queueInvites/${queue.id}`);

      await supertest({ userId: ta.userId })
        .post(`/queueInvites/${queue.id}`)
        .expect(400);
    });
  });
  describe('DELETE /queueInvites/:id', () => {
    it('returns 401 when the user is not logged in', async () => {
      await supertest().delete(`/queueInvites/1`).expect(401);
    });
    it('Deletes a QueueInvite entity for the queue', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });
      await QueueInviteFactory.create({ queue: queue });

      await supertest({ userId: ta.userId })
        .delete(`/queueInvites/${queue.id}`)
        .expect(204);

      const invite = await QueueInviteModel.findOne({
        queueId: queue.id,
      });
      expect(invite).toBeFalsy();
    });
    it('Does not allow students to delete invites', async () => {
      const course = await CourseFactory.create();
      const stu = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });
      await QueueInviteFactory.create({ queueId: queue.id });

      await supertest({ userId: stu.userId })
        .delete(`/queueInvites/${queue.id}`)
        .expect(403);
    });
    it('Does not allow deleting invites for non-existent queues', async () => {
      const ta = await TACourseFactory.create({
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .delete(`/queueInvites/999`)
        .expect(404);
    });
  });
  describe('PATCH /queueInvites/:id', () => {
    it('returns 401 when the user is not logged in', async () => {
      await supertest().patch(`/queueInvites/1`).expect(401);
    });
    it('Updates a QueueInvite entity for the queue', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({ queue: queue });

      const newInvite: QueueInviteParams = {
        queueId: queue.id,
        QRCodeEnabled: true,
        isQuestionsVisible: true,
        willInviteToCourse: true,
        inviteCode: 'newInviteCode',
        QRCodeErrorLevel: 'M',
      };

      await supertest({ userId: ta.userId })
        .patch(`/queueInvites/${queue.id}`)
        .send(newInvite)
        .expect(200);

      const updatedInvite = await QueueInviteModel.findOne({
        queueId: queue.id,
      });

      expect(updatedInvite).toBeTruthy();
      expect(updatedInvite.queueId).toEqual(queue.id);
      expect(updatedInvite.QRCodeEnabled).toEqual(newInvite.QRCodeEnabled);
      expect(updatedInvite.isQuestionsVisible).toEqual(
        newInvite.isQuestionsVisible,
      );
      expect(updatedInvite.willInviteToCourse).toEqual(
        newInvite.willInviteToCourse,
      );
      expect(updatedInvite.inviteCode).toEqual(newInvite.inviteCode);
      expect(updatedInvite.QRCodeErrorLevel).toEqual(
        newInvite.QRCodeErrorLevel,
      );
    });
    it('Does not allow students to update invites', async () => {
      const course = await CourseFactory.create();
      const stu = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({ queue: queue });

      const newInvite: QueueInviteParams = {
        queueId: queue.id,
        QRCodeEnabled: true,
        isQuestionsVisible: true,
        willInviteToCourse: true,
        inviteCode: 'newInviteCode',
        QRCodeErrorLevel: 'M',
      };

      await supertest({ userId: stu.userId })
        .patch(`/queueInvites/${queue.id}`)
        .send(newInvite)
        .expect(403);
    });
    it('Does not allow updating invites for non-existent queues', async () => {
      const ta = await TACourseFactory.create({
        user: await UserFactory.create(),
      });

      const newInvite: QueueInviteParams = {
        queueId: 999,
        QRCodeEnabled: true,
        isQuestionsVisible: true,
        willInviteToCourse: true,
        inviteCode: 'newInviteCode',
        QRCodeErrorLevel: 'M',
      };

      await supertest({ userId: ta.userId })
        .patch(`/queueInvites/999`)
        .send(newInvite)
        .expect(404);
    });
    it('Does not allow updating invites with invalid data', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({ queue: queue });

      const invalidInvite = "I'm not an object";

      await supertest({ userId: ta.userId })
        .patch(`/queueInvites/${queue.id}`)
        .send(invalidInvite)
        .expect(400);

      const invalidInvite2 = {
        queueId: queue.id,
        QRCodeEnabled: 'A',
        isQuestionsVisible: 'B',
        willInviteToCourse: 'C',
        inviteCode: 1,
        QRCodeErrorLevel: 2,
      };

      await supertest({ userId: ta.userId })
        .patch(`/queueInvites/${queue.id}`)
        .send(invalidInvite2)
        .expect(400);
    });
  });
  describe('GET /queueInvites/:id', () => {
    it('returns 200 when the invite exists and works publicly', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      const publicUser = await UserFactory.create();
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({ queue: queue });

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/${queue.id}/${encodeBase64(invite.inviteCode)}`)
        .expect(200);
    });
    it('returns 404 when the queue does not exist', async () => {
      const publicUser = await UserFactory.create();

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/999/invite-code`)
        .expect(404);
    });
    it('returns 404 when the invite is incorrect', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      const publicUser = await UserFactory.create();
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({ queue: queue });

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/${queue.id}/incorrect-invite-code`)
        .expect(404);
    });
  });
  describe('GET /queueInvites/:queueId/:queueInviteCode/questions', () => {
    it('returns 200 when the invite exists and works publicly', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      const publicUser = await UserFactory.create();
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({
        queue: queue,
        isQuestionsVisible: true,
      });

      await supertest({ userId: publicUser.id })
        .get(
          `/queueInvites/${queue.id}/${encodeBase64(invite.inviteCode)}/questions`,
        )
        .expect(200);
    });
    it('returns 404 when the queue does not exist', async () => {
      const publicUser = await UserFactory.create();

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/999/invite-code/questions`)
        .expect(404);
    });
    it('returns 404 when the invite is incorrect', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      const publicUser = await UserFactory.create();
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({
        queue: queue,
        isQuestionsVisible: true,
      });

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/${queue.id}/incorrect-invite-code/questions`)
        .expect(404);
    });
    it('returns 404 when the invite does not have questions visible', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      const publicUser = await UserFactory.create();
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({
        queue: queue,
        isQuestionsVisible: false,
      });

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/${queue.id}/${invite.inviteCode}/questions`)
        .expect(404);
    });
  });
  describe('GET /queueInvites/:queueId/:queueInviteCode/queue', () => {
    it('returns 200 when the invite exists and works publicly', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      const publicUser = await UserFactory.create();
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({
        queue: queue,
        isQuestionsVisible: true,
      });

      await supertest({ userId: publicUser.id })
        .get(
          `/queueInvites/${queue.id}/${encodeBase64(invite.inviteCode)}/queue`,
        )
        .expect(200);
    });
    it('returns 404 when the queue does not exist', async () => {
      const publicUser = await UserFactory.create();

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/999/invite-code/queue`)
        .expect(404);
    });
    it('returns 404 when the invite is incorrect', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      const publicUser = await UserFactory.create();
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({
        queue: queue,
        isQuestionsVisible: true,
      });

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/${queue.id}/incorrect-invite-code/queue`)
        .expect(404);
    });
    it('returns 404 when the invite does not have questions visible', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      const publicUser = await UserFactory.create();
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({
        queue: queue,
        isQuestionsVisible: false,
      });

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/${queue.id}/${invite.inviteCode}/queue`)
        .expect(404);
    });
  });
  describe('GET /queueInvites/:queueId/:queueInviteCode/sse', () => {
    it('returns 404 when the queue does not exist', async () => {
      const publicUser = await UserFactory.create();

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/999/invite-code/sse`)
        .expect(404);
    });
    it('returns 404 when the invite is incorrect', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      const publicUser = await UserFactory.create();
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({
        queue: queue,
        isQuestionsVisible: true,
      });

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/${queue.id}/incorrect-invite-code/sse`)
        .expect(404);
    });
    it('returns 404 when the invite does not have questions visible', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      const publicUser = await UserFactory.create();
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({
        queue: queue,
        isQuestionsVisible: false,
      });

      await supertest({ userId: publicUser.id })
        .get(`/queueInvites/${queue.id}/${invite.inviteCode}/sse`)
        .expect(404);
    });
  });
});
