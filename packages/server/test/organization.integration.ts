import { OrganizationModule } from 'organization/organization.module';
import { setupIntegrationTest } from './util/testUtils';
import {
  ChatTokenFactory,
  CourseFactory,
  mailServiceFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  SemesterFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import {
  MailServiceType,
  OrganizationRole,
  Role,
  UserCourse,
  UserRole,
} from '@koh/common';
import * as fs from 'fs';
import * as path from 'path';
import { UserCourseModel } from 'profile/user-course.entity';
import { CourseSettingsModel } from 'course/course_settings.entity';
import { CourseModel } from 'course/course.entity';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { ChatTokenModel } from 'chatbot/chat-token.entity';
import { CourseService } from 'course/course.service';
import { CourseModule } from 'course/course.module';
import { MailModule } from 'mail/mail.module';

describe('Organization Integration', () => {
  const { supertest, getTestModule } = setupIntegrationTest(
    OrganizationModule,
    undefined,
    [MailModule],
  );
  let courseService: CourseService;

  beforeAll(async () => {
    // Get the instance of CourseService from the module fixture
    const testModule = getTestModule();
    courseService = testModule.get<CourseService>(CourseService);
  });
  describe('POST /organization/:oid/populate_chat_token_table', () => {
    it('should return 401 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().post(
        `/organization/${organization.id}/populate_chat_token_table`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).post(
        `/organization/${organization.id}/populate_chat_token_table`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 200 when chat token table is populated', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id }).post(
        `/organization/${organization.id}/populate_chat_token_table`,
      );

      expect(res.status).toBe(200);
    });
  });

  describe('POST /organization/:oid/add_member/:uid', () => {
    it('should return 403 when user is not logged in', async () => {
      const response = await supertest().post('/organization/1/add_member/1');

      expect(response.status).toBe(401);
    });

    it("should return 200 when user doesn't exist in organization", async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      const res = await supertest({ userId: user.id }).post(
        `/organization/${organization.id}/add_member/${user.id}`,
      );

      expect(res.status).toBe(200);
    });

    it('should return 500 when user already exists in organization', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).post(
        `/organization/${organization.id}/add_member/${user.id}`,
      );

      expect(res.status).toBe(500);
    });
  });

  describe('GET /organization', () => {
    it('should return 200 and list of organizations', async () => {
      await OrganizationFactory.create();
      await OrganizationFactory.create();

      const res = await supertest().get('/organization').expect(200);

      expect(res.body).toMatchSnapshot();
    });
  });

  describe('GET /organization/:oid/get_users/:page?', () => {
    it('should return 403 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().get(
        `/organization/${organization.id}/get_users/1`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_users/1`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 200 when user is an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_users/1`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('GET /organization/:oid/get_courses/:page?', () => {
    it('should return 403 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().get(
        `/organization/${organization.id}/get_courses/1`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_courses/1`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 200 when user is an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_courses/1`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('GET /organization/:oid/stats', () => {
    it('should return 403 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().get(
        `/organization/${organization.id}/stats`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/stats`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 200 when user is an admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
        role: OrganizationRole.PROFESSOR,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/stats`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('GET /organization/:oid/get_user/:uid', () => {
    it('should return 403 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().get(
        `/organization/${organization.id}/get_user/1`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_user/1`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when searching for user not in the same organization', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const organizationTwo = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organizationTwo.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organizationTwo.id}/get_user/${userTwo.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when user to get info is not in the same organization', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const organizationTwo = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organizationTwo.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_user/${userTwo.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when user to get info is admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_user/${userTwo.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 200 when user is found', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_user/${userTwo.id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('GET /organization/:oid', () => {
    it('should return 403 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().get(
        `/organization/${organization.id}`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 200 and response when user is logged in', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}`,
      );

      expect(res.body).toMatchSnapshot();
      expect(res.status).toBe(200);
    });

    it('should throw an error if oid is NaN', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id }).get(
        `/organization/thisisnotanumber`,
      );

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /organization/:oid/update_account_access/:iud', () => {
    it('should return 401 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().patch(
        `/organization/${organization.id}/update_account_access/1`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_account_access/1`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when user to update is organization admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_account_access/${userTwo.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when user to update is global admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create({
        userRole: UserRole.ADMIN,
      });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${userTwo.id}/update_account_access/${userTwo.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 200 when user access is updated', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_account_access/${userTwo.id}`,
      );

      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /organization/:oid/update_user_role', () => {
    it('should return 401 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().patch(
        `/organization/${organization.id}/update_user_role`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const userTwo = await UserFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_user_role`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 400 when request missing body', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const userTwo = await UserFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_user_role`,
      );

      expect(res.status).toBe(400);
    });

    it('should return 400 when user to update is organization admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_user_role`)
        .send({
          userId: userTwo.id,
          organizationRole: OrganizationRole.PROFESSOR,
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 when user to update is not found', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_user_role`)
        .send({
          userId: 0,
          organizationRole: OrganizationRole.PROFESSOR,
        });

      expect(res.status).toBe(404);
    });

    it('should return 200 when user role is updated', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_user_role`)
        .send({
          userId: userTwo.id,
          organizationRole: OrganizationRole.PROFESSOR,
        });

      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /organization/:oid/edit_user/:uid', () => {
    it('should return 401 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().patch(
        `/organization/${organization.id}/edit_user/1`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const userTwo = await UserFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/edit_user/1`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when user to update is global admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create({
        userRole: UserRole.ADMIN,
      });
      const organization = await OrganizationFactory.create();
      const userThree = await UserFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userThree.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/edit_user/${userTwo.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when user to update is organization admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/edit_user/${userTwo.id}`)
        .send({
          firstName: 'test',
          lastName: 'test',
          email: 'test@email.com',
          sid: 1234567,
        });

      expect(res.status).toBe(401);
    });

    it('should return 400 when firstName is too short', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/edit_user/${userTwo.id}`)
        .send({
          firstName: '',
          lastName: 'test',
          email: 'test@email.com',
          sid: 123456,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when lastName is too short', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/edit_user/${userTwo.id}`)
        .send({
          firstName: 'test',
          lastName: '              ',
          email: 'test@email.com',
          sid: 123459,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when email is too short', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/edit_user/${userTwo.id}`)
        .send({
          firstName: 'test',
          lastName: 'test',
          email: '          ',
          sid: 123459,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when student id is smaller than one', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create({
        sid: 200,
      });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/edit_user/${userTwo.id}`)
        .send({
          firstName: 'test',
          lastName: 'test',
          email: 'test@mail.com',
          sid: -1,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when user email to update is already in use', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      await UserFactory.create({
        email: 'test@mail.com',
      });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/edit_user/${userTwo.id}`)
        .send({
          firstName: 'test',
          lastName: 'test',
          email: 'test@mail.com',
          sid: 23,
        });

      expect(res.body.message).toBe('Email is already in use');
      expect(res.status).toBe(400);
    });

    it('should return 200 when user is updated', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/edit_user/${userTwo.id}`)
        .send({
          firstName: 'test',
          lastName: 'test',
          email: 'test@mail.com',
          sid: 23,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User info updated');
    });
  });

  describe('PATCH /organization/:oid/update_course/:cid', () => {
    it('should return 401 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().patch(
        `/organization/${organization.id}/update_course/1`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks sufficient role', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save(); // not a prof

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save(); // not a prof nor admin

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_course/${course.id}`,
      );

      expect(res.status).toBe(403);
    });

    it('should return 404 when course not found', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_course/0`)
        .send({
          name: 'newName',
        });

      expect(res.status).toBe(404);
    });

    it('should return 400 when course name is too short', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_course/${course.id}`)
        .send({
          name: '        ',
        });

      expect(res.body.message).toBe('Course name must be at least 1 character');
      expect(res.status).toBe(400);
    });

    it('should return 400 when course coordinator email is too short', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create({
        coordinator_email: 'test@ubc.ca',
      });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_course/${course.id}`)
        .send({
          name: 'newName',
          coordinator_email: '        ',
        });

      expect(res.body.message).toBe(
        'Coordinator email must be at least 1 character',
      );
      expect(res.status).toBe(400);
    });

    it('should return 400 when section group name is too short', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_course/${course.id}`)
        .send({
          name: 'newName',
          sectionGroupName: '        ',
        });

      expect(res.body.message).toBe(
        'Section group name must be at least 1 character',
      );

      expect(res.status).toBe(400);
    });

    it('should return 400 when course timezone is not valid', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create({
        timezone: 'America/Los_Angeles',
      });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_course/${course.id}`)
        .send({
          name: 'newName',
          timezone: 'invalid_timezone',
          sectionGroupName: 'test',
        });

      expect(res.body.message).toBe(
        'Timezone field is invalid, must be one of America/New_York, ' +
          'America/Los_Angeles, America/Chicago, America/Denver, America/Phoenix, ' +
          'America/Anchorage, America/Honolulu, Europe/London, Europe/Paris, ' +
          'Asia/Tokyo, Asia/Shanghai, Australia/Sydney',
      );
      expect(res.status).toBe(400);
    });

    it('should return 200 when course is updated (org admin)', async () => {
      const user = await UserFactory.create();
      const professor1 = await UserFactory.create();
      const professor2 = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_course/${course.id}`)
        .send({
          name: 'newName',
          timezone: 'America/Los_Angeles',
          sectionGroupName: 'test',
          profIds: [professor1.id, professor2.id],
        });

      expect(res.body.message).toBe('Course updated successfully');
      expect(res.status).toBe(200);
    });
    it('should return 200 when course is updated (course professor)', async () => {
      const user = await UserFactory.create();
      const professor1 = await UserFactory.create();
      const professor2 = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.PROFESSOR,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      await UserCourseModel.create({
        userId: user.id,
        courseId: course.id,
        role: Role.PROFESSOR,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_course/${course.id}`)
        .send({
          name: 'newName',
          timezone: 'America/Los_Angeles',
          sectionGroupName: 'test',
          profIds: [professor1.id, professor2.id],
        });

      expect(res.body.message).toBe('Course updated successfully');
      expect(res.status).toBe(200);
    });
    it('should prevent org professors who are a student in the course from updating the course', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.PROFESSOR, // org professor
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      await UserCourseModel.create({
        userId: user.id,
        courseId: course.id,
        role: Role.STUDENT, // course student
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update_course/${course.id}`)
        .send({
          name: 'newName',
          timezone: 'America/Los_Angeles',
          sectionGroupName: 'test',
          profIds: [user.id], // try to make me the only prof in the course
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /organization/:oid/reset_chat_token_limit', () => {
    it('should return 401 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().post(
        `/organization/${organization.id}/reset_chat_token_limit`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.MEMBER,
      }).save();

      const res = await supertest({ userId: user.id }).post(
        `/organization/${organization.id}/reset_chat_token_limit`,
      );

      expect(res.status).toBe(401);
    });
    it('should reset chat token limits successfully', async () => {
      const admin = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const professor = await UserFactory.create();
      const member = await UserFactory.create();

      await OrganizationUserModel.create({
        userId: admin.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: professor.id,
        organizationId: organization.id,
        role: OrganizationRole.PROFESSOR,
      }).save();

      await OrganizationUserModel.create({
        userId: member.id,
        organizationId: organization.id,
        role: OrganizationRole.MEMBER,
      }).save();

      // Create chat tokens with non-zero 'used' values
      const memberToken = await ChatTokenModel.create({
        user: member,
        used: 50,
        token: 'test1',
        max_uses: 100,
      }).save();

      const professorToken = await ChatTokenModel.create({
        user: professor,
        used: 20,
        token: 'test',
        max_uses: 30,
      }).save();

      const res = await supertest({ userId: admin.id }).post(
        `/organization/${organization.id}/reset_chat_token_limit`,
      );

      expect(res.status).toBe(200);

      // Verify that the chat tokens were reset
      const updatedProfessorToken = await ChatTokenModel.findOne({
        relations: { user: true },
        where: {
          user: {
            id: professor.id,
          },
        },
      });
      const updatedMemberToken = await ChatTokenModel.findOne({
        relations: { user: true },
        where: {
          user: {
            id: member.id,
          },
        },
      });

      expect(updatedProfessorToken.used).toBe(0);
      expect(updatedProfessorToken.max_uses).toBe(300);
      expect(updatedMemberToken.used).toBe(0);
      expect(updatedMemberToken.max_uses).toBe(30);
    });
  });

  describe('POST /organization/:oid/populate_subscription_table', () => {
    it('should populate subscription table correctly for member who is TA in a course', async () => {
      const admin = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const memberTA = await UserFactory.create();
      const course = await CourseFactory.create();

      // Set up admin
      await OrganizationUserModel.create({
        userId: admin.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      // Set up member who is also a TA
      await OrganizationUserModel.create({
        userId: memberTA.id,
        organizationId: organization.id,
        role: OrganizationRole.MEMBER,
      }).save();

      // Add memberTA as TA to the course
      await UserCourseModel.create({
        userId: memberTA.id,
        courseId: course.id,
        role: Role.TA,
      }).save();

      // Create mail services
      const memberService = await mailServiceFactory.create({
        mailType: OrganizationRole.MEMBER,
        serviceType: MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
      });

      const profService = await mailServiceFactory.create({
        mailType: OrganizationRole.PROFESSOR,
        serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
      });

      await UserSubscriptionModel.delete({});

      const res = await supertest({ userId: admin.id }).post(
        `/organization/${organization.id}/populate_subscription_table`,
      );

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Subscription table populated');

      // Verify subscriptions for memberTA
      const memberTASubscriptions = await UserSubscriptionModel.find({
        where: { userId: memberTA.id },
      });

      expect(memberTASubscriptions.length).toBe(2); // Should have all 2 subscriptions

      // Check each subscription
      const memberServiceSub = memberTASubscriptions.find(
        (s) => s.serviceId === memberService.id,
      );
      const profServiceSub = memberTASubscriptions.find(
        (s) => s.serviceId === profService.id,
      );

      expect(memberServiceSub).toBeDefined();
      expect(memberServiceSub?.isSubscribed).toBe(true); // everyone is subscribed

      expect(profServiceSub).toBeDefined();
      expect(profServiceSub?.isSubscribed).toBe(true);

      // Verify admin subscriptions (should remain unchanged)
      const adminSubscriptions = await UserSubscriptionModel.find({
        where: { userId: admin.id },
      });

      expect(adminSubscriptions.length).toBe(2);
      expect(
        adminSubscriptions.find((s) => s.serviceId === memberService.id)
          ?.isSubscribed,
      ).toBe(true);
      expect(
        adminSubscriptions.find((s) => s.serviceId === profService.id)
          ?.isSubscribed,
      ).toBe(true);
    });

    it('should return 401 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().post(
        `/organization/${organization.id}/populate_subscription_table`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.MEMBER,
      }).save();

      const res = await supertest({ userId: user.id }).post(
        `/organization/${organization.id}/populate_subscription_table`,
      );

      expect(res.status).toBe(401);
    });

    it('should populate subscription table successfully', async () => {
      const admin = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const member = await UserFactory.create();

      await OrganizationUserModel.create({
        userId: admin.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: member.id,
        organizationId: organization.id,
        role: OrganizationRole.MEMBER,
      }).save();

      // Create mail services
      const memberService = await mailServiceFactory.create({
        mailType: OrganizationRole.MEMBER,
        serviceType: MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
      });
      const adminService = await mailServiceFactory.create({
        mailType: OrganizationRole.ADMIN,
        serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
      });

      await UserSubscriptionModel.delete({});

      const existingSubscriptions = await UserSubscriptionModel.find();

      const res = await supertest({ userId: admin.id }).post(
        `/organization/${organization.id}/populate_subscription_table`,
      );

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Subscription table populated');

      // Verify that the subscriptions were created correctly
      const subscriptions = await UserSubscriptionModel.find({
        where: [{ userId: admin.id }, { userId: member.id }],
      });

      expect(subscriptions.length).toBe(4); // 2 for admin, 2 for member

      const adminSubscriptions = subscriptions.filter(
        (s) => s.userId === admin.id,
      );
      const memberSubscriptions = subscriptions.filter(
        (s) => s.userId === member.id,
      );

      expect(adminSubscriptions.length).toBe(2);
      expect(memberSubscriptions.length).toBe(2); // member subscribed to all services too

      expect(
        adminSubscriptions.find((s) => s.serviceId === memberService.id)
          ?.isSubscribed,
      ).toBe(true);
      expect(
        adminSubscriptions.find((s) => s.serviceId === adminService.id)
          ?.isSubscribed,
      ).toBe(true);
      expect(memberSubscriptions[0].isSubscribed).toBe(true);
      expect(memberSubscriptions[0].serviceId).toBe(memberService.id);
    });

    it('should populate subscription table correctly for regular member without TA role', async () => {
      const admin = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const regularMember = await UserFactory.create();
      const course = await CourseFactory.create();

      // Set up admin
      await OrganizationUserModel.create({
        userId: admin.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      // Set up regular member
      await OrganizationUserModel.create({
        userId: regularMember.id,
        organizationId: organization.id,
        role: OrganizationRole.MEMBER,
      }).save();

      // Add regularMember as student to the course
      await UserCourseModel.create({
        userId: regularMember.id,
        courseId: course.id,
        role: Role.STUDENT,
      }).save();

      // Create mail services
      const memberService = await mailServiceFactory.create({
        mailType: OrganizationRole.MEMBER,
        serviceType: MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
      });

      const profService = await mailServiceFactory.create({
        mailType: OrganizationRole.PROFESSOR,
        serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
      });

      await UserSubscriptionModel.delete({});

      const res = await supertest({ userId: admin.id }).post(
        `/organization/${organization.id}/populate_subscription_table`,
      );

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Subscription table populated');

      // Verify subscriptions for regularMember
      const regularMemberSubscriptions = await UserSubscriptionModel.find({
        where: { userId: regularMember.id },
      });

      expect(regularMemberSubscriptions.length).toBe(2); // Should be subscribed to all

      // Check the subscription
      const memberServiceSub = regularMemberSubscriptions[0];

      expect(memberServiceSub.serviceId).toBe(memberService.id);
      expect(memberServiceSub.isSubscribed).toBe(true); // Member service should be enabled

      // Verify that there's a professor subscription for regular member
      const profServiceSub = regularMemberSubscriptions.find(
        (s) => s.serviceId === profService.id,
      );
      expect(profServiceSub).toBeDefined();
      expect(profServiceSub?.isSubscribed).toBe(true);

      // Verify admin subscriptions (should remain unchanged)
      const adminSubscriptions = await UserSubscriptionModel.find({
        where: { userId: admin.id },
      });

      expect(adminSubscriptions.length).toBe(2);
      expect(
        adminSubscriptions.find((s) => s.serviceId === memberService.id)
          ?.isSubscribed,
      ).toBe(true); // members are subscribed to everything now
      expect(
        adminSubscriptions.find((s) => s.serviceId === profService.id)
          ?.isSubscribed,
      ).toBe(true);
    });
  });

  describe('PATCH /organization/:oid/update_course_access/:cid', () => {
    it('should return 401 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().patch(
        `/organization/${organization.id}/update_course_access/1`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_course_access/${course.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 404 when course not found', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_course_access/0`,
      );

      expect(res.status).toBe(404);
    });

    it('should return 200 when course access is updated', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_course_access/${course.id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Course access updated');
    });
  });

  describe('GET /organization/:oid/get_course/:cid', () => {
    it('should return 401 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().get(
        `/organization/${organization.id}/get_course/1`,
      );

      expect(response.status).toBe(401);
    });
    it('should return 403 when user is not admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_course/${course.id}`,
      );

      expect(res.status).toBe(403);
    });
    it('should return 404 when course is not found (and user is admin)', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_course/0`,
      );

      expect(res.status).toBe(404);
    });
    it('should return 404 when course is not found (and user is course prof)', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserFactory.create({
        organizationUser: user,
        organization,
      });
      await OrganizationCourseFactory.create({
        course,
        organization,
      });
      await UserCourseFactory.create({
        user,
        course,
        role: Role.PROFESSOR,
      });

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_course/0`,
      );

      expect(res.status).toBe(404);
    });
    it('should return 200 when course is found and user is admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserFactory.create({
        organizationUser: user,
        organization,
        role: OrganizationRole.ADMIN,
      });
      await OrganizationCourseFactory.create({
        course,
        organization,
      });

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_course/${course.id}`,
      );

      expect(res.status).toBe(200);
    });
    it('OrgOrCourseRolesGuard: should return 200 when the user is an org member but course professor', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserFactory.create({
        organizationUser: user,
        organization,
      });
      await OrganizationCourseFactory.create({
        course,
        organization,
      });
      await UserCourseFactory.create({
        user,
        course,
        role: Role.PROFESSOR,
      });

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_course/${course.id}`,
      );

      expect(res.status).toBe(200);
    });
    it('OrgOrCourseRolesGuard: should return 403 when the user is an org member and course student', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();
      await UserCourseModel.create({
        userId: user.id,
        courseId: course.id,
        role: Role.STUDENT,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_course/${course.id}`,
      );

      expect(res.status).toBe(403);
    });
    it('OrgOrCourseRolesGuard: should return 404 when the user is an org prof in one org and member in the main org', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      const otherOrganization = await OrganizationFactory.create();

      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: otherOrganization,
        role: OrganizationRole.PROFESSOR, // prof in other org
      });
      await OrganizationCourseFactory.create({
        course,
        organization,
      });

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_course/${course.id}`,
      );

      expect(res.status).toBe(404);
    });
    it('OrgOrCourseRolesGuard: should return 404 when the user is a course prof in one org and a member in the main org', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      const otherCourse = await CourseFactory.create();
      const otherOrganization = await OrganizationFactory.create();

      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: otherOrganization, // a member in other org
      });
      await OrganizationCourseFactory.create({
        course,
        organization,
      });
      await OrganizationCourseFactory.create({
        course: otherCourse,
        organization: otherOrganization,
      });
      await UserCourseFactory.create({
        user,
        course: otherCourse,
        role: Role.PROFESSOR, // they are a course prof in other org
      });

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_course/${course.id}`, // try to access main org's course
      );

      expect(res.status).toBe(404);
    });
  });

  describe('GET /organization/:oid/get_banner/:photoUrl', () => {
    it('should return 401 when user is not logged in', async () => {
      const response = await supertest().get(`/organization/1/get_banner/1`);

      expect(response.status).toBe(401);
    });

    it('should return 404 when image is not found', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_banner/non_existing_image.png`,
      );

      expect(res.status).toBe(404);
    });

    it('should return 200 when image is found', async () => {
      const file = Buffer.from([]);
      const fileName = 'test.png';

      await fs.writeFileSync(
        `${process.env.UPLOAD_LOCATION}/${fileName}`,
        file,
      );

      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create({
        bannerUrl: fileName,
      });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_banner/${organization.bannerUrl}`,
      );

      expect(res.status).toBe(200);

      await fs.unlinkSync(path.join(process.env.UPLOAD_LOCATION, fileName));
    });
  });

  describe('GET /organization/:oid/get_logo/:photoUrl', () => {
    it('should return 404 when getting an invalid organization', async () => {
      const response = await supertest().get(`/organization/1/get_logo/999`);

      expect(response.status).toBe(404);
    });
    it('should return 200 when user is not logged in since it is public', async () => {
      const file = Buffer.from([]);
      const fileName = 'test.png';

      await fs.writeFileSync(
        `${process.env.UPLOAD_LOCATION}/${fileName}`,
        file,
      );

      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create({
        logoUrl: fileName,
      });

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_logo/${organization.logoUrl}`,
      );

      expect(res.status).toBe(200);

      await fs.unlinkSync(path.join(process.env.UPLOAD_LOCATION, fileName));
    });

    it('should return 404 when image is not found', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_logo/non_existing_image.png`,
      );

      expect(res.status).toBe(404);
    });

    it('should return 200 when image is found', async () => {
      const file = Buffer.from([]);
      const fileName = 'test.png';

      await fs.writeFileSync(
        `${process.env.UPLOAD_LOCATION}/${fileName}`,
        file,
      );

      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create({
        logoUrl: fileName,
      });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/get_logo/${organization.logoUrl}`,
      );

      expect(res.status).toBe(200);

      await fs.unlinkSync(path.join(process.env.UPLOAD_LOCATION, fileName));
    });
  });

  describe('PATCH /organization/:oid/update_account_access/:uid', () => {
    it('should return 401 when user is not logged in', async () => {
      const response = await supertest().patch(
        `/organization/1/update_account_access/1`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when is not admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_account_access/1`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when user to update is organization admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_account_access/${userTwo.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when user to update is global admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create({
        userRole: UserRole.ADMIN,
      });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_account_access/${userTwo.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 200 when user is updated', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update_account_access/${userTwo.id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User account access updated');
    });
  });

  describe('PATCH /organization/:oid/update', () => {
    it('should return 401 when user is not logged in', async () => {
      const response = await supertest().patch(`/organization/1/update`);

      expect(response.status).toBe(401);
    });

    it('should return 401 when is not admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).patch(
        `/organization/${organization.id}/update`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 400 when organization name is too short', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update`)
        .send({
          name: '        ',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'Organization name must be at least 3 characters',
      );
    });

    it('should return 400 when organization description is too short', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update`)
        .send({
          name: 'test',
          description: '        ',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'Organization description must be at least 10 characters',
      );
    });

    it('should return 400 when organization website URL is too short', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create({
        websiteUrl: 'http://ubc.ca',
      });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update`)
        .send({
          name: 'test',
          description: 'Organization description with 10 characters',
          websiteUrl: '        ',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        'Organization URL must be at least 4 characters and be a valid URL',
      );
    });

    it('should return 200 when organization is updated', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create({
        websiteUrl: 'http://ubc.ca',
      });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id })
        .patch(`/organization/${organization.id}/update`)
        .send({
          name: 'test',
          description: 'Organization description with 10 characters',
          websiteUrl: 'https://okanagan.ubc.ca',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Organization updated');
    });
  });

  describe('DELETE /organization/:oid/drop_user_courses/:uid', () => {
    it('should return 401 when user is not logged in', async () => {
      const response = await supertest().delete(
        `/organization/1/drop_user_courses/1`,
      );

      expect(response.status).toBe(401);
    });
    it('should not remove users from their courses if they lack sufficient role', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      const userTwo = await UserFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();
      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();
      await UserCourseModel.create({
        userId: userTwo.id,
        courseId: course.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .delete(
          `/organization/${organization.id}/drop_user_courses/${userTwo.id}`,
        )
        .send([course.id]);

      expect(res.status).toBe(403);
      // check to make sure the user is still in the course
      const userCourses = await UserCourseModel.find({
        where: { userId: userTwo.id },
      });
      expect(userCourses.length).toBe(1);
    });
    it('should return 404 when no courses specified', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const userTwo = await UserFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .delete(
          `/organization/${organization.id}/drop_user_courses/${userTwo.id}`,
        )
        .send([]);

      expect(res.status).toBe(404);
    });
    it('should return 403 when user to update is organization admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      await UserCourseModel.create({
        userId: userTwo.id,
        courseId: course.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .delete(
          `/organization/${organization.id}/drop_user_courses/${userTwo.id}`,
        )
        .send([course.id]);

      expect(res.status).toBe(403);
      // check to make sure the user is still in the course
      const userCourses = await UserCourseModel.find({
        where: { userId: userTwo.id },
      });
      expect(userCourses.length).toBe(1);
    });
    it('should return 403 when user to update is global admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create({
        userRole: UserRole.ADMIN,
      });
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      await UserCourseModel.create({
        userId: userTwo.id,
        courseId: course.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .delete(
          `/organization/${organization.id}/drop_user_courses/${userTwo.id}`,
        )
        .send([course.id]);

      expect(res.status).toBe(403);
      // check to make sure the user is still in the course
      const userCourses = await UserCourseModel.find({
        where: { userId: userTwo.id },
      });
      expect(userCourses.length).toBe(1);
    });
    it('should allow admins to drop a user from multiple courses', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      const course2 = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course2.id,
        organizationId: organization.id,
      }).save();

      await UserCourseModel.create({
        userId: userTwo.id,
        courseId: course.id,
      }).save();
      await UserCourseModel.create({
        userId: userTwo.id,
        courseId: course2.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .delete(
          `/organization/${organization.id}/drop_user_courses/${userTwo.id}`,
        )
        .send([course.id, course2.id]);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User courses deleted');
      // check to make sure the user is no longer in the courses
      const userCourses = await UserCourseModel.find({
        where: { userId: userTwo.id },
      });
      expect(userCourses.length).toBe(0);
    });
    it('Should allow org+course professors to drop students from their courses', async () => {
      const professor = await UserFactory.create();
      const student = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: professor.id,
        organizationId: organization.id,
        role: OrganizationRole.PROFESSOR, // org professor
      }).save();
      await OrganizationUserModel.create({
        userId: student.id,
        organizationId: organization.id,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      await UserCourseModel.create({
        userId: professor.id,
        courseId: course.id,
        role: Role.PROFESSOR, // also course professor (you need to be a course professor in the course in order to drop students)
      }).save();
      await UserCourseModel.create({
        userId: student.id,
        courseId: course.id,
      }).save();

      const res = await supertest({ userId: professor.id })
        .delete(
          `/organization/${organization.id}/drop_user_courses/${student.id}`,
        )
        .send([course.id]);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User courses deleted');
      // check to make sure the user is no longer in the course
      const userCourses = await UserCourseModel.find({
        where: { userId: student.id },
      });
      expect(userCourses.length).toBe(0);
    });
    it('Should allow course professors to drop students from their courses', async () => {
      const professor = await UserFactory.create();
      const student = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: professor.id,
        organizationId: organization.id,
      }).save(); // org member
      await OrganizationUserModel.create({
        userId: student.id,
        organizationId: organization.id,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      await UserCourseModel.create({
        userId: professor.id,
        courseId: course.id,
        role: Role.PROFESSOR, // but course professor
      }).save();
      await UserCourseModel.create({
        userId: student.id,
        courseId: course.id,
      }).save();

      const res = await supertest({ userId: professor.id })
        .delete(
          `/organization/${organization.id}/drop_user_courses/${student.id}`,
        )
        .send([course.id]);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User courses deleted');
      // check to make sure the user is no longer in the course
      const userCourses = await UserCourseModel.find({
        where: { userId: student.id },
      });
      expect(userCourses.length).toBe(0);
    });
    it('Should not drop the student if the prof is not in all courses', async () => {
      const professor = await UserFactory.create();
      const student = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      const course2 = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: professor.id,
        organizationId: organization.id,
      }).save();
      await OrganizationUserModel.create({
        userId: student.id,
        organizationId: organization.id,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course2.id,
        organizationId: organization.id,
      }).save();

      await UserCourseModel.create({
        userId: professor.id,
        courseId: course.id,
        role: Role.PROFESSOR,
      }).save();
      await UserCourseModel.create({
        userId: student.id,
        courseId: course.id,
      }).save();
      await UserCourseModel.create({
        userId: student.id,
        courseId: course2.id,
      }).save();

      const res = await supertest({ userId: professor.id })
        .delete(
          `/organization/${organization.id}/drop_user_courses/${student.id}`,
        )
        .send([course.id, course2.id]); // just in case you are curious, there is no case on the frontend where course profs area able to remove students outside of their course, this is just for robustness sake

      expect(res.status).toBe(403);
      // check to make sure the user is no longer in the course (but still in the other one)
      const userCourses = await UserCourseModel.find({
        where: { userId: student.id },
      });
      expect(userCourses.length).toBe(2);

      // now just try to drop them from the other course
      const res2 = await supertest({ userId: professor.id })
        .delete(
          `/organization/${organization.id}/drop_user_courses/${student.id}`,
        )
        .send([course2.id]);

      expect(res2.status).toBe(403);
      // check to make sure the user is still in the course
      const userCourses2 = await UserCourseModel.find({
        where: { userId: student.id },
      });
      expect(userCourses2.length).toBe(2);
    });
    it('Should return 403 when a professor tries to drop a student from a course they are not teaching', async () => {
      const professor = await UserFactory.create();
      const student = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      const course2 = await CourseFactory.create();

      const profOrgUser = await OrganizationUserModel.create({
        userId: professor.id,
        organizationId: organization.id,
        role: OrganizationRole.PROFESSOR,
      }).save();

      professor.organizationUser = profOrgUser;

      await OrganizationUserModel.create({
        userId: student.id,
        organizationId: organization.id,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      await UserCourseModel.create({
        userId: professor.id,
        courseId: course2.id,
      }).save();
      await UserCourseModel.create({
        userId: student.id,
        courseId: course.id,
      }).save();

      const res = await supertest({ userId: professor.id })
        .delete(
          `/organization/${organization.id}/drop_user_courses/${student.id}`,
        )
        .send([course.id]);

      expect(res.status).toBe(403);
      // check to make sure no one was dropped
      const userCourses = await UserCourseModel.find({
        where: { userId: student.id },
      });
      expect(userCourses.length).toBe(1);
    });
  });

  describe('DELETE /organization/:oid/delete_profile_picture/:uid', () => {
    it('should return 401 when user is not logged in', async () => {
      const response = await supertest().delete(
        `/organization/1/delete_profile_picture/1`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when is not admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).delete(
        `/organization/${organization.id}/delete_profile_picture/1`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when user to update is organization admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id }).delete(
        `/organization/${organization.id}/delete_profile_picture/${userTwo.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 401 when user to update is global admin', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create({
        userRole: UserRole.ADMIN,
      });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).delete(
        `/organization/${organization.id}/delete_profile_picture/${userTwo.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 400 when user has no profile picture', async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create({ photoURL: null });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).delete(
        `/organization/${organization.id}/delete_profile_picture/${userTwo.id}`,
      );

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("User doesn't have a profile picture");
    });

    it("should return 500 when user profile picture doesn't exist", async () => {
      const user = await UserFactory.create();
      const userTwo = await UserFactory.create({
        photoURL: 'non_existing_photo_url',
      });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).delete(
        `/organization/${organization.id}/delete_profile_picture/${userTwo.id}`,
      );

      expect(res.status).toBe(500);
      expect(res.body.message).toBe(
        `Error deleting previous picture at : non_existing_photo_url the previous image was at an invalid location?`,
      );
    });

    it('should return 200 when user profile picture is deleted', async () => {
      const file = Buffer.from([]);
      const fileName = 'test.png';

      await fs.writeFileSync(
        `${process.env.UPLOAD_LOCATION}/${fileName}`,
        file,
      );

      const user = await UserFactory.create();
      const userTwo = await UserFactory.create({
        photoURL: fileName,
      });

      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationUserModel.create({
        userId: userTwo.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).delete(
        `/organization/${organization.id}/delete_profile_picture/${userTwo.id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Profile picture deleted');
    });
  });

  describe('POST /organization/:oid/upload_logo', () => {
    it('should return 401 when user is not logged in', async () => {
      const res = await supertest().post('/organization/1/upload_logo');

      expect(res.status).toBe(401);
    });

    it('should return 401 when user is not admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).post(
        `/organization/${organization.id}/upload_logo`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 200 when existing logo is delete and logo is uploaded', async () => {
      const file = Buffer.from([]);
      const fileName = 'test.png';

      await fs.writeFileSync(
        `${process.env.UPLOAD_LOCATION}/${fileName}`,
        file,
      );

      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create({
        logoUrl: fileName,
      });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/upload_logo`)
        .attach('file', path.join(__dirname, 'fixtures/images/test.png'));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logo uploaded');

      await fs.unlinkSync(
        path.join(process.env.UPLOAD_LOCATION, res.body.fileName),
      );
    });

    it('should return 200 when logo is uploaded', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/upload_logo`)
        .attach('file', path.join(__dirname, 'fixtures/images/test.png'));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logo uploaded');

      await fs.unlinkSync(
        path.join(process.env.UPLOAD_LOCATION, res.body.fileName),
      );
    });
  });

  describe('POST /organization/:oid/upload_banner', () => {
    it('should return 401 when user is not logged in', async () => {
      const res = await supertest().post('/organization/1/upload_banner');

      expect(res.status).toBe(401);
    });

    it('should return 401 when user is not admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).post(
        `/organization/${organization.id}/upload_banner`,
      );

      expect(res.status).toBe(401);
    });
  });

  describe('POST /organization/:oid/create_course', () => {
    it('should return 401 when user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().post(
        `/organization/${organization.id}/create_course`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when user is not an admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).post(
        `/organization/${organization.id}/create_course`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 400 when course name is too short', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/create_course`)
        .send({
          name: '        ',
        });

      expect(res.body.message).toBe('Course name must be at least 1 character');
      expect(res.status).toBe(400);
    });

    it('should return 400 when course coordinator email is too short', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create({
        coordinator_email: 'test@ubc.ca',
      });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/create_course`)
        .send({
          name: 'newName',
          coordinator_email: '        ',
        });

      expect(res.body.message).toBe(
        'Coordinator email must be at least 1 character',
      );
      expect(res.status).toBe(400);
    });

    it('should return 400 when section group name is too short', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/create_course`)
        .send({
          name: 'newName',
          sectionGroupName: '        ',
        });

      expect(res.body.message).toBe(
        'Section group name must be at least 1 character',
      );

      expect(res.status).toBe(400);
    });

    it('should return 400 when course timezone is not valid', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create({
        timezone: 'America/Los_Angeles',
      });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/create_course`)
        .send({
          name: 'newName',
          timezone: 'invalid_timezone',
          sectionGroupName: 'test',
        });

      expect(res.body.message).toBe(
        'Timezone field is invalid, must be one of America/New_York, ' +
          'America/Los_Angeles, America/Chicago, America/Denver, America/Phoenix, ' +
          'America/Anchorage, America/Honolulu, Europe/London, Europe/Paris, ' +
          'Asia/Tokyo, Asia/Shanghai, Australia/Sydney',
      );
      expect(res.status).toBe(400);
    });

    it('should return 202 when no professors are given', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/create_course`)
        .send({
          name: 'newName',
          timezone: 'America/Los_Angeles',
          sectionGroupName: 'test',
          courseSettings: [
            {
              feature: 'asyncQueueEnabled',
              value: false,
            },
          ],
        });

      expect(res.body.message).toBe(
        'Course created successfully. No professors given.',
      );
      expect(res.status).toBe(202);
    });

    it('should return 400 when course settings is invalid', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      const professor1 = await UserFactory.create();

      await SemesterFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      let res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/create_course`)
        .send({
          name: 'newName',
          timezone: 'America/Los_Angeles',
          sectionGroupName: 'test',
          profIds: [professor1.id],
          courseSettings: {
            invalidSetting: true,
          },
        });

      expect(res.body.message).toEqual(['courseSettings must be an array']);
      expect(res.status).toBe(400);

      res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/create_course`)
        .send({
          name: 'newName',
          timezone: 'America/Los_Angeles',
          sectionGroupName: 'test',
          profIds: [professor1.id],
          courseSettings: [
            {
              feature: 'invalidFeature',
              value: true,
            },
          ],
        });

      expect(res.body.message).toEqual('invalid feature: invalidFeature');
      expect(res.status).toBe(400);
    });

    it('should return 202 when a course is created with no course settings provided (which will use defaults)', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      const professor1 = await UserFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();
      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/create_course`)
        .send({
          name: 'newName',
          timezone: 'America/Los_Angeles',
          sectionGroupName: 'test',
          profIds: [professor1.id],
        });

      expect(res.status).toBe(202);
      expect(res.body.message).toBe(
        'Course created successfully. Default settings used.',
      );

      // get the newly created course from the database
      const newCourse = await CourseModel.findOne({
        where: { name: 'newName' },
      });

      // Fetch the updated courseSettings from the database
      const updatedCourseSettings = await CourseSettingsModel.findOne({
        where: { courseId: newCourse.id },
      });

      expect(updatedCourseSettings.chatBotEnabled).toEqual(true);
      expect(updatedCourseSettings.asyncQueueEnabled).toEqual(true);
      expect(updatedCourseSettings.adsEnabled).toEqual(true);
      expect(updatedCourseSettings.queueEnabled).toEqual(true);
      expect(updatedCourseSettings.asyncCentreAIAnswers).toEqual(true);
      expect(updatedCourseSettings.scheduleOnFrontPage).toEqual(false);
    });

    it('should return 200 when course is created', async () => {
      const user = await UserFactory.create();
      const professor1 = await UserFactory.create();
      const professor2 = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id })
        .post(`/organization/${organization.id}/create_course`)
        .send({
          name: 'newName',
          timezone: 'America/Los_Angeles',
          sectionGroupName: 'test',
          profIds: [professor1.id, professor2.id],
          courseSettings: [
            {
              feature: 'chatBotEnabled',
              value: true,
            },
            {
              feature: 'queueEnabled',
              value: false,
            },
            {
              feature: 'asyncQueueEnabled',
              value: true,
            },
            {
              feature: 'asyncCentreAIAnswers',
              value: false,
            },
            {
              feature: 'scheduleOnFrontPage',
              value: true,
            },
          ],
        });

      expect(res.body.message).toBe('Course created successfully.');
      expect(res.status).toBe(200);

      // get the newly created course from the database
      const newCourse = await CourseModel.findOne({
        where: { name: 'newName' },
      });

      // check to make sure courseSettings is correct
      const updatedCourseSettings = await CourseSettingsModel.findOne({
        where: { courseId: newCourse.id },
      });

      expect(updatedCourseSettings.chatBotEnabled).toEqual(true);
      expect(updatedCourseSettings.asyncQueueEnabled).toEqual(true);
      expect(updatedCourseSettings.adsEnabled).toEqual(true); // ungiven value defaults to their default value (true)
      expect(updatedCourseSettings.queueEnabled).toEqual(false);
      expect(updatedCourseSettings.asyncCentreAIAnswers).toEqual(false);
      expect(updatedCourseSettings.scheduleOnFrontPage).toEqual(true);
    });
  });

  describe('GET /organization/:oid/cronjobs', () => {
    it('should return 401 when user is not logged in', async () => {
      const res = await supertest().get('/organization/1/cronjobs');

      expect(res.status).toBe(401);
    });

    it('should return 401 when user is not admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/cronjobs`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 200 when user is admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/cronjobs`,
      );

      expect(res.status).toBe(200);
    });
  });

  describe('POST /organization/:oid/clone_courses', () => {
    const modifyModule = (builder) => {
      return builder.overrideProvider(CourseService).useValue({
        cloneCourse: jest
          .fn()
          .mockImplementation((courseId, userId, body, token) => {
            return Promise.resolve({
              course: {
                id: courseId,
                name: 'Test Sample Course',
                semesterId: 1,
                enabled: true,
                sectionGroupName: '001',
              },
              role: Role.PROFESSOR,
              favourited: true,
            } as UserCourse);
          }),
        performBatchClone: jest.fn().mockImplementation(async () => {
          // Do nothing to prevent async operations after DB closure
          return Promise.resolve();
        }),
      });
    };

    const { supertest, getTestModule } = setupIntegrationTest(
      CourseModule,
      modifyModule,
      [MailModule],
    );

    it('should return 401 if user is not logged in', async () => {
      const organization = await OrganizationFactory.create();
      const response = await supertest().post(
        `/organization/${organization.id}/clone_courses`,
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 if user is not an admin', async () => {
      0;
      const user = await UserFactory.create();
      // Ensure user has a chat token for the guard to pass initial checks before role check
      const token = await ChatTokenFactory.create({ user });
      user.chat_token = token;
      await user.save();
      const organization = await OrganizationFactory.create();

      // Use factory to create the organization user link
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: organization,
        role: OrganizationRole.MEMBER,
      });

      const response = await supertest({ userId: user.id }).post(
        `/organization/${organization.id}/clone_courses`,
      );

      // Expect 401 Unauthorized because the user is logged in but not an admin
      expect(response.status).toBe(401);
    });

    it('should return 404 if user has no chat token', async () => {
      const admin = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: admin.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
      }).save();

      const response = await supertest({ userId: admin.id }).post(
        `/organization/${organization.id}/clone_courses`,
      );

      expect(response.status).toBe(404);
    });

    it('should queue batch cloning operation successfully', async () => {
      const admin = await UserFactory.create();
      // Associate chat token via factory relationship
      const chatToken = await ChatTokenFactory.create({ user: admin });
      admin.chat_token = chatToken;
      await admin.save();

      const organization = await OrganizationFactory.create();
      const course1 = await CourseFactory.create();
      const course2 = await CourseFactory.create();
      const semester1 = await SemesterFactory.create({ organization }); // Ensure semesters belong to the org
      const semester2 = await SemesterFactory.create({ organization });

      // Use factory for consistency
      await OrganizationUserFactory.create({
        organizationUser: admin,
        organization: organization,
        role: OrganizationRole.ADMIN,
      });

      // Use factory for consistency
      await OrganizationCourseFactory.create({
        course: course1,
        organization: organization,
      });
      await OrganizationCourseFactory.create({
        course: course2,
        organization: organization,
      });

      const toClone = {
        [course1.id]: { name: 'Cloned Course 1', semesterId: semester1.id },
        [course2.id]: { name: 'Cloned Course 2', semesterId: semester2.id },
      };

      const response = await supertest({ userId: admin.id })
        .post(`/organization/${organization.id}/clone_courses`)
        .send(toClone);

      expect(response.status).toBe(201);
      expect(response.text).toBe(
        'Batch Cloning Operation Successfully Queued!',
      );
    });
  });
});
