import { ProfInviteModule } from 'course/prof-invite/prof-invite.module';
import {
  overrideEmailService,
  setupIntegrationTest,
  expectEmailSent,
} from './util/testUtils';
import {
  CourseFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  UserFactory,
} from './util/factories';
import { ProfInviteModel } from 'course/prof-invite/prof-invite.entity';
import { ProfInviteService } from 'course/prof-invite/prof-invite.service';
import {
  CreateProfInviteParams,
  MailServiceType,
  OrganizationRole,
  QUERY_PARAMS,
} from '@koh/common';
import { UserModel } from 'profile/user.entity';
import { OrganizationModel } from 'organization/organization.entity';
import { CourseModel } from 'course/course.entity';

describe('ProfInvite Integration', () => {
  const { supertest, getTestModule } = setupIntegrationTest(
    ProfInviteModule,
    overrideEmailService,
  );

  // used when testing with snapshots to say "hey, don't test for exact values for these" since they're gonna be different each time
  const inviteMatcher = {
    code: expect.any(String),
    createdAt: expect.any(String),
    expiresAt: expect.any(String),
  };

  let adminUser: UserModel; // Admin of Org A
  let memberUser: UserModel; // Member of Org A
  let outsiderUser: UserModel; // Random user
  let otherOrgAdmin: UserModel; // Admin of Org B

  let orgA: OrganizationModel;
  let orgB: OrganizationModel;
  let courseA: CourseModel;
  let inviteA: ProfInviteModel;

  let service: ProfInviteService;

  beforeAll(() => {
    service = getTestModule().get<ProfInviteService>(ProfInviteService);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    adminUser = await UserFactory.create({ email: 'admin@a.com' });
    memberUser = await UserFactory.create({ email: 'member@a.com' });
    outsiderUser = await UserFactory.create({ email: 'out@side.com' });
    otherOrgAdmin = await UserFactory.create({ email: 'admin@b.com' });

    orgA = await OrganizationFactory.create({ name: 'Org A' });
    orgB = await OrganizationFactory.create({ name: 'Org B' });

    await OrganizationUserFactory.create({
      organizationUser: adminUser,
      organization: orgA,
      role: OrganizationRole.ADMIN,
    });
    await OrganizationUserFactory.create({
      organizationUser: memberUser,
      organization: orgA,
      role: OrganizationRole.MEMBER,
    });
    await OrganizationUserFactory.create({
      organizationUser: otherOrgAdmin,
      organization: orgB,
      role: OrganizationRole.ADMIN,
    });

    courseA = await CourseFactory.create({
      name: 'Course A',
    });
    await OrganizationCourseFactory.create({
      organization: orgA,
      course: courseA,
    });
    // Create via service to ensure valid defaults/code
    inviteA = await service.createProfInvite(orgA.id, courseA.id, adminUser.id);
  });

  describe('Permissions', () => {
    const endpoints = [
      {
        method: 'get',
        path: () => `/prof_invites/all/${orgA.id}`,
        desc: 'GET All Invites',
      },
      {
        method: 'post',
        path: () => `/prof_invites/${orgA.id}`,
        data: () =>
          ({
            courseId: courseA.id,
            orgId: orgA.id,
          }) satisfies CreateProfInviteParams,
        desc: 'CREATE Invite',
      },
      {
        method: 'delete',
        path: () => `/prof_invites/${orgA.id}/${inviteA.id}`,
        desc: 'DELETE Invite',
      },
    ];

    describe('Unauthorized Access (Non-Admins)', () => {
      it.each(endpoints)(
        '$desc: Member should get 403',
        async ({ method, path, data }) => {
          // Member
          await supertest({ userId: memberUser.id })
            [method](path())
            .send(typeof data === 'function' ? data() : data)
            .expect(403);
        },
      );
      it.each(endpoints)(
        '$desc: Outsider should get 401',
        async ({ method, path, data }) => {
          // Outsider
          await supertest({ userId: outsiderUser.id })
            [method](path())
            .send(typeof data === 'function' ? data() : data)
            .expect(401);
        },
      );
    });

    describe('Cross-Org Security', () => {
      it.each(endpoints)(
        '$desc: Admin of Org B cannot access Org A',
        async ({ method, path, data }) => {
          await supertest({ userId: otherOrgAdmin.id })
            [method](path())
            .send(typeof data === 'function' ? data() : data)
            .expect(401);
        },
      );
    });

    describe('Org Admin Access', () => {
      it('Admin of Org A CAN access these endpoints', async () => {
        await supertest({ userId: adminUser.id })
          .get(`/prof_invites/all/${orgA.id}`)
          .expect(200);

        // (Need valid payload to avoid 400/500, but 201 proves auth worked)
        await supertest({ userId: adminUser.id })
          .post(`/prof_invites/${orgA.id}`)
          .send({
            courseId: courseA.id,
            orgId: orgA.id,
          })
          .expect(201);

        await supertest({ userId: adminUser.id })
          .delete(`/prof_invites/${orgA.id}/${inviteA.id}`)
          .expect(200);
      });
    });
  });

  describe('GET /prof_invites/all/:orgId', () => {
    it('Retrieves invites', async () => {
      const res = await supertest({ userId: adminUser.id })
        .get(`/prof_invites/all/${orgA.id}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      const invite = res.body[0];
      expect(invite).toHaveProperty('code');
      expect(invite.course.name).toBe('Course A');
      expect(invite.adminUser.email).toBe('admin@a.com');

      expect(invite).not.toHaveProperty('organization');

      expect(res.body).toMatchSnapshot([inviteMatcher]);
    });

    it('List Filtering: Filter by courseId', async () => {
      const courseB = await CourseFactory.create({
        name: 'Course B',
      });
      await OrganizationCourseFactory.create({
        organization: orgA,
        course: courseB,
      });
      const inviteB = await service.createProfInvite(
        orgA.id,
        courseB.id,
        adminUser.id,
      );

      // No courseId given - all invites
      const res1 = await supertest({ userId: adminUser.id })
        .get(`/prof_invites/all/${orgA.id}`)
        .expect(200);
      expect(res1.body).toHaveLength(2);

      // Filter for Course B
      const res2 = await supertest({ userId: adminUser.id })
        .get(`/prof_invites/all/${orgA.id}?courseId=${courseB.id}`)
        .expect(200);
      expect(res2.body).toHaveLength(1);
      expect(res2.body[0].id).toBe(inviteB.id);

      const responses = {
        allInvites: res1.body,
        filteredInvites: res2.body,
      };
      expect(responses).toMatchSnapshot({
        allInvites: [inviteMatcher, inviteMatcher],
        filteredInvites: [inviteMatcher],
      });
    });

    it('Does NOT return invites from other organizations', async () => {
      // Create invite in Org B
      const courseOrgB = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization: orgB,
        course: courseOrgB,
      });
      await service.createProfInvite(orgB.id, courseOrgB.id, otherOrgAdmin.id);

      const res = await supertest({ userId: adminUser.id })
        .get(`/prof_invites/all/${orgA.id}`)
        .expect(200);

      // Should only see Org A invites
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(inviteA.id);

      expect(res.body).toMatchSnapshot([inviteMatcher]);
    });
  });

  describe('POST /prof_invites/:orgId', () => {
    it('Creates an invite and returns it', async () => {
      const res = await supertest({ userId: adminUser.id })
        .post(`/prof_invites/${orgA.id}`)
        .send({
          courseId: courseA.id,
          orgId: orgA.id,
          maxUses: 10,
          makeOrgProf: false,
        })
        .expect(201);

      expect(res.body.maxUses).toBe(10);
      expect(res.body.makeOrgProf).toBe(false);
      expect(res.body.course.id).toBe(courseA.id);

      expect(res.body).toMatchSnapshot(inviteMatcher);

      const dbInvite = await ProfInviteModel.findOneBy({ id: res.body.id });
      expect(dbInvite).toBeDefined();
    });
  });

  describe('DELETE /prof_invites/:orgId/:piid', () => {
    it('Deletes the invite', async () => {
      await supertest({ userId: adminUser.id })
        .delete(`/prof_invites/${orgA.id}/${inviteA.id}`)
        .expect(200);

      const dbInvite = await ProfInviteModel.findOneBy({ id: inviteA.id });
      expect(dbInvite).toBeNull();
    });
  });

  describe('GET /prof_invites/details/:piid', () => {
    it('Public access: returns simple details', async () => {
      // Unauthenticated request
      const res = await supertest()
        .get(`/prof_invites/details/${inviteA.id}`)
        .expect(200);

      expect(res.body).toEqual({
        courseId: courseA.id,
        orgId: orgA.id,
      });
    });

    it('Returns 404 for invalid ID', async () => {
      await supertest().get(`/prof_invites/details/99999`).expect(404);
    });
  });

  describe('POST /prof_invites/accept/:piid', () => {
    it('Accepts invite and redirects', async () => {
      const res = await supertest({ userId: memberUser.id })
        .post(`/prof_invites/accept/${inviteA.id}`)
        .send({ code: inviteA.code })
        .expect(201); // Controller returns string, Nest wraps in 201 by default for POST

      const params = new URLSearchParams({
        notice: QUERY_PARAMS.profInvite.notice.inviteAccepted,
      });
      expect(res.text).toBe(`/course/${courseA.id}?${params.toString()}`);
    });

    it('Email Integration: Full flow with failure then success', async () => {
      await supertest({ userId: memberUser.id })
        .post(`/prof_invites/accept/${inviteA.id}`)
        .send({ code: 'BAD_CODE' })
        .expect(201);
      let inviteAWithFullRelations = await ProfInviteModel.findOne({
        where: { id: inviteA.id },
        relations: {
          // needs extra relations for email construction
          course: true,
          adminUser: {
            organizationUser: true,
          },
        },
      });
      const userAWithFullRelations = await UserModel.findOne({
        where: { id: memberUser.id },
        relations: {
          courses: true,
          organizationUser: true,
        },
      });

      const failureEmail = service.constructWrongCodeEmail(
        userAWithFullRelations,
        inviteAWithFullRelations,
        'BAD_CODE',
      );
      expectEmailSent(
        [adminUser.email],
        [MailServiceType.ADMIN_NOTICE],
        failureEmail.subject,
        failureEmail.content,
      );
      jest.clearAllMocks();

      await supertest({ userId: memberUser.id })
        .post(`/prof_invites/accept/${inviteA.id}`)
        .send({ code: inviteA.code })
        .expect(201);
      inviteAWithFullRelations = await ProfInviteModel.findOne({
        // construct email with newest data
        where: { id: inviteA.id },
        relations: {
          course: true,
          adminUser: {
            organizationUser: true,
          },
        },
      });

      const successEmail = service.constructSuccessEmail(
        userAWithFullRelations,
        inviteAWithFullRelations,
        inviteA.code,
        0,
      );
      expectEmailSent(
        [adminUser.email],
        [MailServiceType.ADMIN_NOTICE],
        successEmail.subject,
        successEmail.content,
      );
    });
  });
});
