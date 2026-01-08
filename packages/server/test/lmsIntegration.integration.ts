import {
  ERROR_MESSAGES,
  LMSApiResponseStatus,
  LMSIntegrationPlatform,
  LMSResourceType,
  OrganizationRole,
  Role,
} from '@koh/common';
import {
  CourseFactory,
  LMSAccessTokenFactory,
  LMSAuthStateFactory,
  lmsCourseIntFactory,
  lmsOrgIntFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationSettingsFactory,
  OrganizationUserFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { UserCourseModel } from '../src/profile/user-course.entity';
import {
  failedPermsCheckForCourse,
  setupIntegrationTest,
} from './util/testUtils';
import { LmsIntegrationModule } from '../src/lmsIntegration/lmsIntegration.module';
import { OrganizationUserModel } from '../src/organization/organization-user.entity';
import { CourseModel } from '../src/course/course.entity';
import { UserModel } from '../src/profile/user.entity';
import { LMSIntegrationService } from '../src/lmsIntegration/lmsIntegration.service';
import * as crypto from 'crypto';
import { LMSAccessTokenModel } from '../src/lmsIntegration/lms-access-token.entity';
import { OrganizationModel } from '../src/organization/organization.entity';
import { LMSOrganizationIntegrationModel } from '../src/lmsIntegration/lmsOrgIntegration.entity';
import { LMSAuthStateModel } from '../src/lmsIntegration/lms-auth-state.entity';
import { AbstractLMSAdapter } from '../src/lmsIntegration/lmsIntegration.adapter';
import { pick } from 'lodash';
import { LMSCourseIntegrationModel } from '../src/lmsIntegration/lmsCourseIntegration.entity';

jest.setTimeout(10000);
describe('Lms Integration Integrations', () => {
  const { supertest } = setupIntegrationTest(LmsIntegrationModule);

  let prof: UserModel;
  let course: CourseModel;
  let organization: OrganizationModel;

  beforeEach(async () => {
    prof = await UserFactory.create();
    course = await CourseFactory.create();
    organization = await OrganizationFactory.create();

    await UserCourseModel.create({
      userId: prof.id,
      courseId: course.id,
      role: Role.PROFESSOR,
    }).save();

    await OrganizationUserFactory.create({
      organizationUser: prof,
      organization,
    });

    await OrganizationCourseFactory.create({
      course,
      organization,
    });
  });

  describe('GET lms/org/:oid/*', () => {
    it.each([OrganizationRole.PROFESSOR, OrganizationRole.MEMBER])(
      'should return 403 when org non-administrator calls route',
      async (orgRole: OrganizationRole) => {
        const user = await UserFactory.create();
        const organization = await OrganizationFactory.create();

        await OrganizationUserModel.create({
          userId: user.id,
          organizationId: organization.id,
          role: orgRole,
        }).save();

        const res = await supertest({ userId: user.id }).get(
          `/lms/org/${organization.id}`,
        );

        expect(res.status).toBe(403);
      },
    );
  });

  describe('GET /lms/:courseId/*', () => {
    it.each([
      { role: Role.STUDENT, route: '' },
      { role: Role.STUDENT, route: '/students' },
      { role: Role.STUDENT, route: '/assignments' },
      { role: Role.TA, route: '' },
      { role: Role.TA, route: '/students' },
      { role: Role.TA, route: '/assignments' },
    ])(
      'should return 403 when non-professor accesses route',
      async ({ role, route }) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}${route}`,
          role,
          'GET',
          supertest,
        );
      },
    );
  });

  describe('POST /lms/:courseId/test', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/test`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it('should return 404 if organization course not found', async () => {
      const course = await CourseFactory.create();
      const prof = await UserCourseFactory.create({
        course,
        role: Role.PROFESSOR,
      });

      await supertest({ userId: prof.userId })
        .post(`/lms/${prof.courseId}/test`)
        .send({ apiPlatform: LMSIntegrationPlatform.Canvas, apiCourseId: '0' })
        .expect(404)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            LMSApiResponseStatus.InvalidConfiguration,
          );
        });
    });

    it('should return 404 if organization integration not found', async () => {
      const org = await OrganizationFactory.create();
      const prof = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });
      await OrganizationCourseFactory.create({
        course: prof.course,
        organization: org,
      });

      await supertest({ userId: prof.userId })
        .post(`/lms/${prof.courseId}/test`)
        .send({ apiPlatform: LMSIntegrationPlatform.Canvas, apiCourseId: '0' })
        .expect(404)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            LMSApiResponseStatus.InvalidConfiguration,
          );
        });
    });

    it('should return 400 if access token not found and api key not passed', async () => {
      const org = await OrganizationFactory.create();
      const prof = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });
      await OrganizationCourseFactory.create({
        course: prof.course,
        organization: org,
      });
      await lmsOrgIntFactory.create({
        apiPlatform: LMSIntegrationPlatform.Canvas,
        organization: org,
      });

      await supertest({ userId: prof.userId })
        .post(`/lms/${prof.courseId}/test`)
        .send({ apiPlatform: LMSIntegrationPlatform.Canvas, apiCourseId: '0' })
        .expect(400)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.missingApiKeyOrToken,
          );
        });
    });

    it('should return 401 if access token does not belong to user', async () => {
      const org = await OrganizationFactory.create();
      const prof = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });
      const user2 = await UserFactory.create();
      await OrganizationCourseFactory.create({
        course: prof.course,
        organization: org,
      });
      const orgInt = await lmsOrgIntFactory.create({
        apiPlatform: LMSIntegrationPlatform.Canvas,
        organization: org,
      });
      const token = await LMSAccessTokenFactory.create({
        user: user2,
        organizationIntegration: orgInt,
      });

      await supertest({ userId: prof.userId })
        .post(`/lms/${prof.courseId}/test`)
        .send({
          apiPlatform: LMSIntegrationPlatform.Canvas,
          apiCourseId: '0',
          accessTokenId: token.id,
        })
        .expect(401)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.unauthorizedForToken,
          );
        });
    });
  });

  describe('GET lms/course/:id', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/course/${id}`,
          courseRole,
          'GET',
          supertest,
        );
      },
    );
  });

  describe('POST lms/course/:id/upsert', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/course/${id}/upsert`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it('should return 404 if organization course not found', async () => {
      const course = await CourseFactory.create();
      const prof = await UserCourseFactory.create({
        course,
        role: Role.PROFESSOR,
      });

      await supertest({ userId: prof.userId })
        .post(`/lms/course/${prof.courseId}/upsert`)
        .send({ apiPlatform: LMSIntegrationPlatform.Canvas })
        .expect(404)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.organizationCourseNotFound,
          );
        });
    });

    it('should return 404 if organization integration not found', async () => {
      const org = await OrganizationFactory.create();
      const prof = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });
      await OrganizationCourseFactory.create({
        course: prof.course,
        organization: org,
      });

      await supertest({ userId: prof.userId })
        .post(`/lms/course/${prof.courseId}/upsert`)
        .send({ apiPlatform: LMSIntegrationPlatform.Canvas })
        .expect(404)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.orgLmsIntegrationNotFound,
          );
        });
    });

    it.each([false, true])(
      'should return 400 if organization doesnt allow api keys and access token not specified',
      async (courseIntExists: boolean) => {
        const orgIntegration = await lmsOrgIntFactory.create({
          organization,
          apiPlatform: LMSIntegrationPlatform.Canvas,
        });
        if (courseIntExists) {
          await lmsCourseIntFactory.create({
            orgIntegration,
          });
        }
        await OrganizationSettingsFactory.create({
          organization,
          allowLMSApiKey: false,
        });

        const props = {
          apiPlatform: LMSIntegrationPlatform.Canvas,
          apiKey: crypto.randomBytes(32).toString('hex'),
        };

        await supertest({ userId: prof.id })
          .post(`/lms/course/${course.id}/upsert`)
          .send(props)
          .expect(400)
          .then((response) => {
            expect(response.body).toHaveProperty(
              'message',
              ERROR_MESSAGES.lmsController.apiKeyDisabled,
            );
          });
      },
    );

    it('should return 400 if organization if api key not passed/disallowed and access token not found', async () => {
      await lmsOrgIntFactory.create({
        organization,
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });
      const props = {
        apiPlatform: LMSIntegrationPlatform.Canvas,
      };

      await OrganizationSettingsFactory.create({
        organization,
        allowLMSApiKey: true,
      });

      await supertest({ userId: prof.id })
        .post(`/lms/course/${course.id}/upsert`)
        .send(props)
        .expect(400)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.missingApiKeyOrToken,
          );
        });
    });

    it('should return 400 if organization if api key not passed but is allowed and access token not found', async () => {
      await lmsOrgIntFactory.create({
        organization,
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });
      const props = {
        apiPlatform: LMSIntegrationPlatform.Canvas,
      };

      await supertest({ userId: prof.id })
        .post(`/lms/course/${course.id}/upsert`)
        .send(props)
        .expect(400)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.missingApiKeyOrToken,
          );
        });
    });

    it('should return 401 if passed access token doesnt belong to user', async () => {
      const orgIntegration = await lmsOrgIntFactory.create({
        organization,
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });
      const token = await LMSAccessTokenFactory.create({
        organizationIntegration: orgIntegration,
      });
      const props = {
        apiPlatform: LMSIntegrationPlatform.Canvas,
        accessTokenId: token.id,
      };

      await supertest({ userId: prof.id })
        .post(`/lms/course/${course.id}/upsert`)
        .send(props)
        .expect(401)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.unauthorizedForToken,
          );
        });
    });

    it('should return 400 if access token passed and access token platform doesnt match org integration', async () => {
      await lmsOrgIntFactory.create({
        organization,
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });
      const orgIntegration2 = await lmsOrgIntFactory.create({
        apiPlatform: LMSIntegrationPlatform.None,
        organization,
      });
      const token = await LMSAccessTokenFactory.create({
        organizationIntegration: orgIntegration2,
        user: prof,
      });
      const props = {
        apiPlatform: LMSIntegrationPlatform.Canvas,
        accessTokenId: token.id,
      };

      await supertest({ userId: prof.id })
        .post(`/lms/course/${course.id}/upsert`)
        .send(props)
        .expect(400)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.accessTokenMismatch,
          );
        });
    });

    it('should return 400 if api course ID is already in use', async () => {
      const orgIntegration = await lmsOrgIntFactory.create({
        organization,
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });
      const course2 = await CourseFactory.create();
      await lmsCourseIntFactory.create({
        orgIntegration,
        course: course2,
        apiCourseId: '1',
      });
      const token = await LMSAccessTokenFactory.create({
        organizationIntegration: orgIntegration,
        user: prof,
      });
      const props = {
        apiPlatform: LMSIntegrationPlatform.Canvas,
        apiCourseId: '1',
        accessTokenId: token.id,
      };

      await supertest({ userId: prof.id })
        .post(`/lms/course/${course.id}/upsert`)
        .send(props)
        .expect(400)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.apiCourseIdInUse,
          );
        });
    });

    it.each([
      ['on create', false, false, false],
      ['on update', true, false, false],
      ['on create', false, true, false],
      ['on update', true, true, false],
      ['on create', false, false, true],
      ['on update', true, false, true],
      ['on create', false, true, true],
      ['on update', true, true, true],
    ])(
      '%s: should return 201 and strip properties depending if access token/api key passed',
      async (_m, isUpdate, useApiKey, allowLMSApiKey) => {
        const orgIntegration = await lmsOrgIntFactory.create({
          organization,
          apiPlatform: LMSIntegrationPlatform.Canvas,
        });
        await OrganizationSettingsFactory.create({
          organization,
          allowLMSApiKey,
        });
        const origToken = await LMSAccessTokenFactory.create({
          organizationIntegration: orgIntegration,
          user: prof,
        });
        const token = await LMSAccessTokenFactory.create({
          organizationIntegration: orgIntegration,
          user: prof,
        });
        const props = {
          apiPlatform: LMSIntegrationPlatform.Canvas,
          apiCourseId: '1',
          accessTokenId: token.id,
          apiKey: crypto.randomBytes(32).toString('hex'),
          apiKeyExpiry: new Date(),
        };

        if (!allowLMSApiKey || (allowLMSApiKey && !useApiKey)) {
          delete props.apiKey;
        }

        if (isUpdate) {
          await lmsCourseIntFactory.create({
            orgIntegration,
            course,
            apiCourseId: '0',
            apiKey: crypto.randomBytes(32).toString('hex'),
            apiKeyExpiry: new Date(0),
            accessTokenId: origToken.id,
          });
        }

        await supertest({ userId: prof.id })
          .post(`/lms/course/${course.id}/upsert`)
          .send(props)
          .expect(201)
          .then((response) => {
            if (isUpdate) {
              expect(response.text).toEqual(
                `Successfully updated link with ${orgIntegration.apiPlatform}`,
              );
            } else {
              expect(response.text).toEqual(
                `Successfully linked course with ${orgIntegration.apiPlatform}`,
              );
            }
          });

        const result = await LMSCourseIntegrationModel.findOne({
          where: {
            courseId: course.id,
          },
        });

        expect(result.apiCourseId).toEqual('1');
        if (!useApiKey || !allowLMSApiKey) {
          expect(result.apiKey).toBeNull();
          expect(result.apiKeyExpiry).toBeNull();
          expect(result.accessTokenId).toEqual(props.accessTokenId);
        } else {
          expect(result.accessTokenId).toBeNull();
          expect(result.apiKey).toEqual(props.apiKey);
          expect(result.apiKeyExpiry).toEqual(props.apiKeyExpiry);
        }
      },
    );
  });

  describe('DELETE lms/course/:id/remove', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/course/${id}/remove`,
          courseRole,
          'DELETE',
          supertest,
        );
      },
    );

    it('should fail with 404 if course integration not found', async () => {
      await supertest({ userId: prof.id })
        .delete(`/lms/course/${course.id}/remove`)
        .expect(404)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.courseLmsIntegrationNotFound,
          );
        });
    });

    it('should delete the course integration', async () => {
      const orgIntegration = await lmsOrgIntFactory.create({
        organization,
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });
      await lmsCourseIntFactory.create({
        course,
        orgIntegration,
      });

      await supertest({ userId: prof.id })
        .delete(`/lms/course/${course.id}/remove`)
        .expect(200)
        .then((response) => {
          expect(response.text).toEqual(
            `Successfully disconnected LMS integration`,
          );
        });

      expect(
        await LMSCourseIntegrationModel.findOne({
          where: { courseId: course.id },
        }),
      ).toBeNull();
    });
  });

  describe('POST lms/course/:id/sync', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it('should return 404 when LMS course integration doesnt exist', async () => {
      const res = await supertest({ userId: prof.id }).post(
        `/lms/${course.id}/sync`,
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST lms/course/:id/sync/force', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/force`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it('should return 404 when LMS course integration doesnt exist', async () => {
      const res = await supertest({ userId: prof.id }).post(
        `/lms/${course.id}/sync/force`,
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE lms/:id/sync/clear', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/clear`,
          courseRole,
          'DELETE',
          supertest,
        );
      },
    );

    it('should return 200 when LMS course integration exists', async () => {
      const orgInt = await lmsOrgIntFactory.create();
      await lmsCourseIntFactory.create({
        orgIntegration: orgInt,
        course: course,
      });

      const res = await supertest({ userId: prof.id }).delete(
        `/lms/${course.id}/sync/clear`,
      );
      expect(res.statusCode).toBe(200);
    });

    it('should return 404 when LMS course integration doesnt exist', async () => {
      const res = await supertest({ userId: prof.id }).delete(
        `/lms/${course.id}/sync/clear`,
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST lms/:id/sync/*/:id/toggle', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/announcement/0/toggle`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/assignment/0/toggle`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/page/0/toggle`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/file/0/toggle`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );
  });

  describe('GET lms/org/:oid/token', () => {
    it.each([OrganizationRole.PROFESSOR, OrganizationRole.MEMBER])(
      'should return 403 when org non-administrator calls route',
      async (orgRole: OrganizationRole) => {
        const user = await UserFactory.create();
        const organization = await OrganizationFactory.create();

        await OrganizationUserModel.create({
          userId: user.id,
          organizationId: organization.id,
          role: orgRole,
        }).save();

        const res = await supertest({ userId: user.id }).get(
          `/lms/org/${organization.id}/token`,
        );

        expect(res.status).toBe(403);
      },
    );

    it("should return the organization's access tokens", async () => {
      const user = await UserFactory.create();
      const nonAdmin = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserFactory.create({
        organizationUser: user,
        organization,
        role: OrganizationRole.ADMIN,
      });

      const tokens: LMSAccessTokenModel[] = [];
      for (const platform of Object.values(LMSIntegrationPlatform)) {
        const int = await lmsOrgIntFactory.create({
          organization,
          apiPlatform: platform,
        });
        tokens.push(
          await LMSAccessTokenFactory.create({
            user,
            organizationIntegration: int,
          }),
        );
        tokens.push(
          await LMSAccessTokenFactory.create({
            user: nonAdmin,
            organizationIntegration: int,
          }),
        );
      }

      await supertest({ userId: user.id })
        .get(`/lms/org/${organization.id}/token`)
        .expect(200)
        .then((response) => {
          expect(response.body).toEqual(
            expect.arrayContaining(
              tokens.map((v) => ({
                id: v.id,
                userId: v.userId,
                userName: v.user.name,
                userEmail: v.user.email,
                platform: v.organizationIntegration.apiPlatform,
              })),
            ),
          );
        });
    });

    it("should return the organization's access tokens for a given platform", async () => {
      const user = await UserFactory.create();
      const nonAdmin = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserFactory.create({
        organizationUser: user,
        organization,
        role: OrganizationRole.ADMIN,
      });

      const tokens: LMSAccessTokenModel[] = [];
      for (const platform of Object.values(LMSIntegrationPlatform)) {
        const int = await lmsOrgIntFactory.create({
          organization,
          apiPlatform: platform,
        });
        tokens.push(
          await LMSAccessTokenFactory.create({
            user,
            organizationIntegration: int,
          }),
        );
        tokens.push(
          await LMSAccessTokenFactory.create({
            user: nonAdmin,
            organizationIntegration: int,
          }),
        );
      }

      await supertest({ userId: user.id })
        .get(`/lms/org/${organization.id}/token?platform=Canvas`)
        .expect(200)
        .then((response) => {
          expect(response.body).toEqual(
            tokens
              .filter(
                (v) =>
                  v.organizationIntegration.apiPlatform ==
                  LMSIntegrationPlatform.Canvas,
              )
              .map((v) => ({
                id: v.id,
                userId: v.userId,
                userName: v.user.name,
                userEmail: v.user.email,
                platform: v.organizationIntegration.apiPlatform,
              })),
          );
        });
    });
  });

  describe('DELETE lms/org/:oid/token', () => {
    it.each([OrganizationRole.PROFESSOR, OrganizationRole.MEMBER])(
      'should return 403 when org non-administrator calls route',
      async (orgRole: OrganizationRole) => {
        const user = await UserFactory.create();
        const organization = await OrganizationFactory.create();

        await OrganizationUserModel.create({
          userId: user.id,
          organizationId: organization.id,
          role: orgRole,
        }).save();

        const res = await supertest({ userId: user.id }).delete(
          `/lms/org/${organization.id}/token/1`,
        );

        expect(res.status).toBe(403);
      },
    );

    it('should fail with 404 if token not found', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserFactory.create({
        organizationUser: user,
        organization,
        role: OrganizationRole.ADMIN,
      });

      await supertest({ userId: user.id })
        .delete(`/lms/org/${organization.id}/token/0`)
        .expect(404)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.accessTokenNotFound,
          );
        });
    });

    it("should return the organization's access tokens for a given platform", async () => {
      const user = await UserFactory.create();
      const nonAdmin = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const orgInt = await lmsOrgIntFactory.create({
        organization,
      });

      await OrganizationUserFactory.create({
        organizationUser: user,
        organization,
        role: OrganizationRole.ADMIN,
      });

      const token = await LMSAccessTokenFactory.create({
        user: nonAdmin,
        organizationIntegration: orgInt,
      });

      const spy = jest.spyOn(
        LMSIntegrationService.prototype,
        'destroyAccessToken',
      );
      spy.mockResolvedValue(true);

      await supertest({ userId: user.id })
        .delete(`/lms/org/${organization.id}/token/${token.id}`)
        .expect(200)
        .then((response) => {
          expect(response.text).toEqual('true');
        });

      spy.mockRestore();
    });
  });

  describe('GET lms/oauth2/token', () => {
    it('should return 401 if user is not authorized', async () => {
      await supertest().get('/lms/oauth2/token').expect(401);
    });

    it("should return 200 and list of user's access tokens", async () => {
      const orgInt = await lmsOrgIntFactory.create({});
      const user = await UserFactory.create();
      const tokens = await LMSAccessTokenFactory.createList(3, {
        user,
        organizationIntegration: orgInt,
      });

      await supertest({ userId: user.id })
        .get('/lms/oauth2/token')
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveLength(3);
          for (let i = 0; i < tokens.length; i++) {
            expect(response.body[i]).toEqual({
              id: tokens[i].id,
              platform: tokens[i].organizationIntegration.apiPlatform,
            });
          }
        });
    });
  });

  describe('GET lms/oauth2/can_generate', () => {
    enum CanGenerateConditions {
      NO_ORGANIZATION_USER = 'user has no organization user',
      NO_ORG_INTEGRATION = 'organization has no integrations',
      NO_ORG_INTEGRATION_WITH_PLATFORM = 'organization does not have an integration for platform',
      NO_CLIENT_ID = 'integration has no client id',
      NO_CLIENT_SECRET = 'integration has no client secret',
    }

    it('should return 400 if platform is omitted', async () => {
      const user = await UserFactory.create();
      await supertest({ userId: user.id })
        .get('/lms/oauth2/can_generate')
        .expect(400);
    });

    it('should return 401 if user is not authorized', async () => {
      await supertest()
        .get('/lms/oauth2/can_generate?platform=Canvas')
        .expect(401);
    });

    it.each([
      CanGenerateConditions.NO_ORGANIZATION_USER,
      CanGenerateConditions.NO_ORG_INTEGRATION,
      CanGenerateConditions.NO_ORG_INTEGRATION_WITH_PLATFORM,
      CanGenerateConditions.NO_CLIENT_SECRET,
      CanGenerateConditions.NO_CLIENT_ID,
    ])(
      'should return false if %s',
      async (condition: CanGenerateConditions) => {
        const organization = await OrganizationFactory.create();

        const user =
          condition == CanGenerateConditions.NO_ORGANIZATION_USER
            ? await UserFactory.create()
            : await OrganizationUserFactory.create({ organization }).then(
                (res) => res.organizationUser,
              );

        if (
          condition != CanGenerateConditions.NO_ORG_INTEGRATION_WITH_PLATFORM &&
          condition != CanGenerateConditions.NO_ORG_INTEGRATION
        ) {
          await lmsOrgIntFactory.create({
            organization,
            apiPlatform: LMSIntegrationPlatform.Canvas,
            clientId:
              condition == CanGenerateConditions.NO_CLIENT_ID ? '1' : null,
            clientSecret:
              condition == CanGenerateConditions.NO_CLIENT_SECRET
                ? 'sflkglksdfjghsfgh'
                : null,
          });
        } else if (
          condition == CanGenerateConditions.NO_ORG_INTEGRATION_WITH_PLATFORM
        ) {
          await lmsOrgIntFactory.create({
            organization,
            apiPlatform: LMSIntegrationPlatform.None,
          });
        }

        await supertest({ userId: user.id })
          .get('/lms/oauth2/can_generate?platform=Canvas')
          .expect(200)
          .then((res) => expect(res.text).toEqual('false'));
      },
    );

    it('should return true if integration exists and has defined clientId and clientSecret', async () => {
      const orgInt = await lmsOrgIntFactory.create({
        apiPlatform: LMSIntegrationPlatform.Canvas,
        clientId: '1',
        clientSecret: 'abc',
      });
      const user = await OrganizationUserFactory.create({
        organization: orgInt.organization,
      }).then((res) => res.organizationUser);
      await supertest({ userId: user.id })
        .get('/lms/oauth2/can_generate?platform=Canvas')
        .expect(200)
        .then((res) => expect(res.text).toEqual('true'));
    });
  });

  describe('DELETE lms/oauth2/token/:tokenId', () => {
    it('should return 401 if user is not authorized', async () => {
      await supertest().delete('/lms/oauth2/token/1').expect(401);
    });

    it('should return 401 if user is authorized but is not token owner/token not found in users tokens', async () => {
      const user = await UserFactory.create();

      await supertest({ userId: user.id })
        .delete('/lms/oauth2/token/1')
        .expect(401)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.unauthorizedForToken,
          );
        });
    });

    it('should call to destroy access token and return 200 with boolean', async () => {
      const orgInt = await lmsOrgIntFactory.create({});
      const user = await UserFactory.create();
      const token = await LMSAccessTokenFactory.create({
        user,
        organizationIntegration: orgInt,
      });
      const spy = jest.spyOn(
        LMSIntegrationService.prototype,
        'destroyAccessToken',
      );
      spy.mockResolvedValue(true);

      await supertest({ userId: user.id })
        .delete(`/lms/oauth2/token/${token.id}`)
        .expect(200)
        .then((response) => {
          expect(response.text).toStrictEqual('true');
        });

      spy.mockRestore();
    });
  });

  describe('GET lms/oauth2/authorize', () => {
    let user: UserModel;

    beforeEach(async () => {
      user = await UserFactory.create();
    });

    it('should return 401 if user is not authorized', async () => {
      await supertest().get('/lms/oauth2/authorize').expect(401);
    });

    it('should fail with 400 if platform query param is missing', async () => {
      await supertest({ userId: user.id })
        .get('/lms/oauth2/authorize')
        .expect(400)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.missingPlatformQuery,
          );
        });
    });

    it('should fail if organization integration with platform not found', async () => {
      const org = await OrganizationFactory.create({});
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: org,
      });
      await supertest({ userId: user.id })
        .get('/lms/oauth2/authorize?platform=Canvas')
        .then((response) => {
          expect(response.headers).toHaveProperty(
            'location',
            `/courses?error_message=${ERROR_MESSAGES.lmsController.orgLmsIntegrationNotFound.split(' ').join('+')}&platform=undefined`,
          );
        });
    });

    it('should fail if orgIntegration is missing clientId', async () => {
      const org = await OrganizationFactory.create({});
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: org,
      });
      await lmsOrgIntFactory.create({
        organization: org,
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });
      await supertest({ userId: user.id })
        .get('/lms/oauth2/authorize?platform=Canvas')
        .then((response) => {
          expect(response.headers).toHaveProperty(
            'location',
            `/courses?error_message=${ERROR_MESSAGES.lmsController.missingClientId.split(' ').join('+')}&platform=Canvas`,
          );
        });
    });

    it('should fail if orgIntegration is missing clientSecret', async () => {
      const org = await OrganizationFactory.create({});
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: org,
      });
      await lmsOrgIntFactory.create({
        organization: org,
        apiPlatform: LMSIntegrationPlatform.Canvas,
        clientId: 'id',
      });
      await supertest({ userId: user.id })
        .get('/lms/oauth2/authorize?platform=Canvas')
        .then((response) => {
          expect(response.headers).toHaveProperty(
            'location',
            `/courses?error_message=${ERROR_MESSAGES.lmsController.missingClientSecret.split(' ').join('+')}&platform=Canvas`,
          );
        });
    });

    it('should fail if user is not an org professor or org admin', async () => {
      const org = await OrganizationFactory.create({});
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: org,
      });
      await lmsOrgIntFactory.create({
        organization: org,
        apiPlatform: LMSIntegrationPlatform.Canvas,
        clientId: 'id',
        clientSecret: crypto.randomBytes(32).toString('hex'),
      });
      await supertest({ userId: user.id })
        .get('/lms/oauth2/authorize?platform=Canvas')
        .then((response) => {
          expect(response.headers).toHaveProperty(
            'location',
            `/courses?error_message=${encodeURIComponent(
              ERROR_MESSAGES.roleGuard.mustBeRoleToAccess([
                OrganizationRole.ADMIN,
                OrganizationRole.PROFESSOR,
              ]),
            )
              .replace(/%20/g, '+')
              .split(' ')
              .join('+')}&platform=Canvas`,
          );
        });
    });

    it('should succeed and skip generation if user already has a token for the platform', async () => {
      const org = await OrganizationFactory.create({});
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: org,
        role: OrganizationRole.PROFESSOR,
      });
      const orgInt = await lmsOrgIntFactory.create({
        organization: org,
        apiPlatform: LMSIntegrationPlatform.Canvas,
        clientId: 'id',
        clientSecret: crypto.randomBytes(32).toString('hex'),
      });
      await LMSAccessTokenFactory.create({
        organizationIntegration: orgInt,
        user,
      });

      await supertest({ userId: user.id })
        .get('/lms/oauth2/authorize?platform=Canvas')
        .then((response) => {
          expect(response.headers).toHaveProperty(
            'location',
            `/courses?success_message=Access token for use with ${orgInt.apiPlatform} has already been created.`
              .split(' ')
              .join('+'),
          );
        });
    });

    it('should succeed and move on to generating state, etc and redirect to auth', async () => {
      const org = await OrganizationFactory.create({});
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: org,
        role: OrganizationRole.PROFESSOR,
      });
      const orgInt = await lmsOrgIntFactory.create({
        rootUrl: 'baseUrl',
        organization: org,
        apiPlatform: LMSIntegrationPlatform.Canvas,
        clientId: 'id',
        clientSecret: crypto.randomBytes(32).toString('hex'),
      });

      await supertest({ userId: user.id })
        .get('/lms/oauth2/authorize?platform=Canvas')
        .expect(302)
        .then((response) => {
          const uri = new URL(response.headers.location);

          expect(uri.pathname).toBe('/login/oauth2/auth');
          expect(uri.searchParams.get('client_id')).toEqual(orgInt.clientId);
          expect(uri.searchParams.get('response_type')).toEqual('code');
          expect(uri.searchParams.get('scope')).toBeDefined();
          expect(uri.searchParams.get('state')).toBeDefined();
          expect(uri.searchParams.get('redirect_uri')).toEqual(
            `${process.env.DOMAIN}/api/v1/lms/oauth2/response`,
          );
        });
    });
  });

  describe('GET lms/oauth2/response', () => {
    let org: OrganizationModel;
    let user: UserModel;
    let orgInt: LMSOrganizationIntegrationModel;
    let state: LMSAuthStateModel;

    beforeEach(async () => {
      org = await OrganizationFactory.create();
      user = await UserFactory.create();
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: org,
        role: OrganizationRole.PROFESSOR,
      });
      orgInt = await lmsOrgIntFactory.create({
        rootUrl: 'baseUrl',
        organization: org,
        apiPlatform: LMSIntegrationPlatform.Canvas,
        clientId: 'id',
        clientSecret: crypto.randomBytes(32).toString('hex'),
      });
      state = await LMSAuthStateFactory.create({
        user,
        organizationIntegration: orgInt,
      });
    });

    it('should return 401 if user is not authorized', async () => {
      await supertest().get('/lms/oauth2/response').expect(401);
    });

    it('should fail if error or error_description specified in search params', async () => {
      const params = new URLSearchParams({
        error: 'error',
        error_description: 'some error occurred',
        state: state.state,
      });
      await supertest({ userId: user.id })
        .get(`/lms/oauth2/response?${params.toString()}`)
        .expect(302)
        .then((response) => {
          const uri = new URL('http://example.com' + response.headers.location);
          expect(uri.pathname).toBe('/courses');
          expect(uri.searchParams.get('error_message')).toEqual(
            `${params.get('error')}: ${params.get('error_description')}`,
          );
        });
    });

    it('should fail if no state is found matching the search params state value', async () => {
      const params = new URLSearchParams({
        state: '12345',
      });
      await supertest({ userId: user.id })
        .get(`/lms/oauth2/response?${params.toString()}`)
        .expect(302)
        .then((response) => {
          const uri = new URL('http://example.com' + response.headers.location);
          expect(uri.pathname).toBe('/courses');
          expect(uri.searchParams.get('error_message')).toEqual(
            ERROR_MESSAGES.lmsController.stateNotFound,
          );
        });
    });

    it('should fail if the code search param is not specified', async () => {
      const params = new URLSearchParams({
        state: state.state,
      });
      await supertest({ userId: user.id })
        .get(`/lms/oauth2/response?${params.toString()}`)
        .expect(302)
        .then((response) => {
          const uri = new URL('http://example.com' + response.headers.location);
          expect(uri.pathname).toBe('/courses');
          expect(uri.searchParams.get('error_message')).toEqual(
            ERROR_MESSAGES.lmsController.missingCodeQueryParameter,
          );
        });
    });

    it('should fail if the state model is found but is expired', async () => {
      const expiredState = await LMSAuthStateFactory.create({
        user,
        organizationIntegration: orgInt,
        expiresInSeconds: 0,
      });
      const params = new URLSearchParams({
        state: expiredState.state,
        code: crypto.randomBytes(32).toString('hex'),
      });
      await supertest({ userId: user.id })
        .get(`/lms/oauth2/response?${params.toString()}`)
        .expect(302)
        .then((response) => {
          const uri = new URL('http://example.com' + response.headers.location);
          expect(uri.pathname).toBe('/courses');
          expect(uri.searchParams.get('error_message')).toEqual(
            ERROR_MESSAGES.lmsController.stateExpired,
          );
        });
    });

    it('should fail if the organization integration referenced by the state doesnt have a client id', async () => {
      await LMSOrganizationIntegrationModel.update(
        {
          organizationId: orgInt.organizationId,
          apiPlatform: orgInt.apiPlatform,
        },
        {
          clientId: null,
        },
      );
      const params = new URLSearchParams({
        state: state.state,
        code: crypto.randomBytes(32).toString('hex'),
      });
      await supertest({ userId: user.id })
        .get(`/lms/oauth2/response?${params.toString()}`)
        .expect(302)
        .then((response) => {
          const uri = new URL('http://example.com' + response.headers.location);
          expect(uri.pathname).toBe('/courses');
          expect(uri.searchParams.get('error_message')).toEqual(
            ERROR_MESSAGES.lmsController.missingClientId,
          );
        });
    });

    it('should fail if the organization integration referenced by the state doesnt have a client secret', async () => {
      await LMSOrganizationIntegrationModel.update(
        {
          organizationId: orgInt.organizationId,
          apiPlatform: orgInt.apiPlatform,
        },
        {
          clientSecret: null,
        },
      );
      const params = new URLSearchParams({
        state: state.state,
        code: crypto.randomBytes(32).toString('hex'),
      });
      await supertest({ userId: user.id })
        .get(`/lms/oauth2/response?${params.toString()}`)
        .expect(302)
        .then((response) => {
          const uri = new URL('http://example.com' + response.headers.location);
          expect(uri.pathname).toBe('/courses');
          expect(uri.searchParams.get('error_message')).toEqual(
            ERROR_MESSAGES.lmsController.missingClientSecret,
          );
        });
    });

    it('should succeed validation and post a request to get an auth token and error if failed', async () => {
      const spy = jest.spyOn(AbstractLMSAdapter, 'postAuth');
      spy.mockResolvedValue({
        ok: false,
      } as unknown as Response);

      const params = new URLSearchParams({
        state: state.state,
        code: crypto.randomBytes(32).toString('hex'),
      });
      await supertest({ userId: user.id })
        .get(`/lms/oauth2/response?${params.toString()}`)
        .expect(302)
        .then((response) => {
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy).toHaveBeenCalledWith(
            {
              grant_type: 'authorization_code',
              client_id: orgInt.clientId,
              client_secret: orgInt.clientSecret,
              redirect_uri: `${process.env.DOMAIN}/api/v1/lms/oauth2/response`,
              code: params.get('code'),
            },
            pick(orgInt, [
              'apiPlatform',
              'clientId',
              'clientSecret',
              'organizationId',
              'rootUrl',
              'secure',
            ]),
          );

          const uri = new URL('http://example.com' + response.headers.location);
          expect(uri.pathname).toBe('/courses');
          expect(uri.searchParams.get('error_message')).toEqual(
            ERROR_MESSAGES.lmsController.failedToGetAccessToken,
          );
        });
      spy.mockRestore();
    });

    it('should succeed validation and post a reuqest to get an auth token and generate if succeeded', async () => {
      const access = {
        access_token: crypto.randomBytes(32).toString('hex'),
        token_type: 'bearer',
        user: { id: 1, name: 'fake user' },
        refresh_token: crypto.randomBytes(32).toString('hex'),
        expires_in: 1000,
      };
      const spy = jest.spyOn(AbstractLMSAdapter, 'postAuth');
      spy.mockResolvedValue({
        ok: true,
        json: async () => access,
      } as unknown as Response);

      const params = new URLSearchParams({
        state: state.state,
        code: crypto.randomBytes(32).toString('hex'),
      });
      await supertest({ userId: user.id })
        .get(`/lms/oauth2/response?${params.toString()}`)
        .expect(302)
        .then((response) => {
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy).toHaveBeenCalledWith(
            {
              grant_type: 'authorization_code',
              client_id: orgInt.clientId,
              client_secret: orgInt.clientSecret,
              redirect_uri: `${process.env.DOMAIN}/api/v1/lms/oauth2/response`,
              code: params.get('code'),
            },
            pick(orgInt, [
              'apiPlatform',
              'clientId',
              'clientSecret',
              'organizationId',
              'rootUrl',
              'secure',
            ]),
          );

          const uri = new URL('http://example.com' + response.headers.location);
          expect(uri.pathname).toBe('/courses');
          expect(uri.searchParams.get('success_message')).toEqual(
            `Generated access token for use with ${orgInt.apiPlatform}!`,
          );
        });

      const newToken = await LMSAccessTokenModel.findOne({
        where: {
          userId: user.id,
          organizationIntegration: {
            organizationId: orgInt.organizationId,
            apiPlatform: orgInt.apiPlatform,
          },
        },
        relations: {
          organizationIntegration: true,
        },
      });

      const decrypted = await newToken.getToken();
      expect(decrypted).toEqual({
        access_token: access.access_token,
        token_type: access.token_type,
        userId: access.user.id,
        refresh_token: access.refresh_token,
        expires_in: access.expires_in,
      });

      spy.mockRestore();
    });
  });

  describe('GET lms/course/list/:tokenId', () => {
    it('should return 401 if user is not authorized', async () => {
      await supertest().get('/lms/course/list/1').expect(401);
    });

    it('should return 401 if user is not authorized for token', async () => {
      const user = await UserFactory.create();
      await supertest({ userId: user.id })
        .get('/lms/course/list/1')
        .expect(401)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.lmsController.unauthorizedForToken,
          );
        });
    });
  });

  describe('Quiz endpoints resource protection', () => {
    beforeEach(async () => {
      const orgInt = await lmsOrgIntFactory.create();
      await lmsCourseIntFactory.create({
        orgIntegration: orgInt,
        course: course,
        // Set up integration without quiz resource enabled
        selectedResourceTypes: [
          LMSResourceType.ASSIGNMENTS,
          LMSResourceType.ANNOUNCEMENTS,
          LMSResourceType.PAGES,
        ],
      });
    });

    describe('GET /lms/:courseId/quizzes', () => {
      it('should return 400 when quiz resource is disabled', async () => {
        const res = await supertest({ userId: prof.id }).get(
          `/lms/${course.id}/quizzes`,
        );
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('resource type');
      });
    });

    describe('GET /lms/:courseId/quiz/:quizId/preview/:accessLevel', () => {
      it('should return 400 when quiz resource is disabled', async () => {
        const res = await supertest({ userId: prof.id }).get(
          `/lms/${course.id}/quiz/1/preview/logistics_only`,
        );
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('resource type');
      });
    });

    describe('POST /lms/:courseId/quizzes/bulk-sync', () => {
      it('should return 400 when quiz resource is disabled', async () => {
        const res = await supertest({ userId: prof.id })
          .post(`/lms/${course.id}/quizzes/bulk-sync`)
          .send({ action: 'enable', quizIds: [1] });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('resource type');
      });
    });

    describe('POST /lms/:courseId/quiz/:quizId/access-level', () => {
      it('should return 400 when quiz resource is disabled', async () => {
        const res = await supertest({ userId: prof.id })
          .post(`/lms/${course.id}/quiz/1/access-level`)
          .send({ accessLevel: 'logistics_only' });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('resource type');
      });
    });
  });
});
