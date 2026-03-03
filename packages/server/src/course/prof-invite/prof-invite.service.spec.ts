import {
  MailServiceType,
  OrganizationRole,
  QUERY_PARAMS,
  Role,
} from '@koh/common';
import { TestingModule } from '@nestjs/testing';
import { ProfInviteModule } from './prof-invite.module';
import { ProfInviteService } from './prof-invite.service';
import { ProfInviteModel } from './prof-invite.entity';
import {
  expectEmailSent,
  expectEmailNotSent,
  overrideEmailService,
  setupIntegrationTest,
} from '../../../test/util/testUtils';
import {
  CourseFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  UserCourseFactory,
  UserFactory,
} from '../../../test/util/factories';
import { UserModel } from 'profile/user.entity';
import { CourseModel } from 'course/course.entity';
import { OrganizationModel } from 'organization/organization.entity';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { UserCourseModel } from 'profile/user-course.entity';

describe('ProfInviteService', () => {
  const { getTestModule } = setupIntegrationTest(
    ProfInviteModule,
    overrideEmailService,
  );

  let service: ProfInviteService;
  let module: TestingModule;

  // Shared state
  let admin: UserModel;
  let user: UserModel;
  let org: OrganizationModel;
  let course: CourseModel;

  beforeAll(async () => {
    module = getTestModule();
    service = module.get<ProfInviteService>(ProfInviteService);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    admin = await UserFactory.create({
      firstName: 'Admin',
      email: 'admin@test.com',
    });
    user = await UserFactory.create({
      firstName: 'User',
      email: 'user@test.com',
    });
    org = await OrganizationFactory.create();
    course = await CourseFactory.create();
    await OrganizationCourseFactory.create({
      course: course,
      organization: org,
    });

    const orgUserAdmin = await OrganizationUserFactory.create({
      organizationUser: admin,
      organization: org,
      role: OrganizationRole.ADMIN,
    });
    admin.organizationUser = orgUserAdmin;
    // assume that the user will always already be part of the org
    const orgUserMember = await OrganizationUserFactory.create({
      organizationUser: user,
      organization: org,
      role: OrganizationRole.MEMBER,
    });
    user.organizationUser = orgUserMember; // setting this attribute for email construction reasons
  });

  describe('createProfInvite', () => {
    it('creates an invite with default values (maxUses=1, makeOrgProf=true, 7 day expiry)', async () => {
      const invite = await service.createProfInvite(
        org.id,
        course.id,
        admin.id,
      );

      expect(invite).toBeDefined();
      expect(invite.maxUses).toBe(1);
      expect(invite.makeOrgProf).toBe(true);
      expect(invite.usesUsed).toBe(0);
      expect(invite.code).toHaveLength(12);

      // Check expiry is roughly 7 days from now
      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(invite.expiresAt.getTime() - sevenDays.getTime());
      expect(diff).toBeLessThan(10000); // within 10 seconds
    });

    it('creates an invite with custom values', async () => {
      const customDate = new Date(Date.now() + 100000);
      const invite = await service.createProfInvite(
        org.id,
        course.id,
        admin.id,
        5, // maxUses
        customDate,
        false, // makeOrgProf
      );

      expect(invite.maxUses).toBe(5);
      expect(invite.makeOrgProf).toBe(false);
      expect(invite.expiresAt.toISOString()).toBe(customDate.toISOString());
    });
  });

  describe('acceptProfInvite', () => {
    let invite: ProfInviteModel;

    /* Used to get the full relations of an invite for constructing the email */
    const findInviteWithRelations = async (id: number) => {
      return await ProfInviteModel.findOne({
        where: { id },
        relations: {
          course: true,
          adminUser: {
            organizationUser: true,
          },
        },
      });
    };

    beforeEach(async () => {
      invite = await service.createProfInvite(org.id, course.id, admin.id);
    });

    it('Standard Acceptance: User added as Professor (and made org prof), Admin Notified', async () => {
      const url = await service.acceptProfInvite(
        user.id,
        invite.id,
        invite.code,
      );

      const params = new URLSearchParams({
        notice: QUERY_PARAMS.profInvite.notice.inviteAccepted,
      });
      expect(url).toBe(`/course/${course.id}?${params.toString()}`);

      const userCourse = await UserCourseModel.findOne({
        where: { userId: user.id, courseId: course.id },
      });
      expect(userCourse).toBeDefined();
      expect(userCourse.role).toBe(Role.PROFESSOR);

      const orgUser = await OrganizationUserModel.findOne({
        where: { userId: user.id, organizationId: org.id },
      });
      expect(orgUser.role).toBe(OrganizationRole.PROFESSOR);

      const updatedInvite = await ProfInviteModel.findOneBy({
        id: invite.id,
      });
      expect(updatedInvite.usesUsed).toBe(1);

      const fullInvite = await findInviteWithRelations(invite.id);
      const email = service.constructSuccessEmail(
        user,
        fullInvite,
        fullInvite.code,
        0, // remaining uses (1 max - 1 used)
      );
      expectEmailSent(
        [admin.email],
        [MailServiceType.ADMIN_NOTICE],
        email.subject,
        email.content,
      );
    });

    it('No Org Role Promotion: Does not promote if makeOrgProf is false', async () => {
      const noPromoteInvite = await service.createProfInvite(
        org.id,
        course.id,
        admin.id,
        1,
        undefined,
        false, // makeOrgProf
      );

      const url = await service.acceptProfInvite(
        user.id,
        noPromoteInvite.id,
        noPromoteInvite.code,
      );

      const params = new URLSearchParams({
        notice: QUERY_PARAMS.profInvite.notice.inviteAccepted,
      });
      expect(url).toBe(`/course/${course.id}?${params.toString()}`);

      const userCourse = await UserCourseModel.findOne({
        where: { userId: user.id, courseId: course.id },
      });
      expect(userCourse).toBeDefined();
      expect(userCourse.role).toBe(Role.PROFESSOR);

      const orgUser = await OrganizationUserModel.findOne({
        where: { userId: user.id, organizationId: org.id },
      });
      expect(orgUser.role).toBe(OrganizationRole.MEMBER); // NOT promoted to org prof

      const updatedInvite = await ProfInviteModel.findOneBy({
        id: noPromoteInvite.id,
      });
      expect(updatedInvite.usesUsed).toBe(1);

      const fullInvite = await findInviteWithRelations(noPromoteInvite.id);
      const email = service.constructSuccessEmail(
        user,
        fullInvite,
        fullInvite.code,
        0,
      );
      expectEmailSent(
        [admin.email],
        [MailServiceType.ADMIN_NOTICE],
        email.subject,
        email.content,
      );
    });

    it('Multiple Uses: Invite with maxUses=2 allows two users', async () => {
      const multiInvite = await service.createProfInvite(
        org.id,
        course.id,
        admin.id,
        2,
      );
      const user2 = await UserFactory.create();
      await OrganizationUserFactory.create({
        organizationUser: user2,
        organization: org,
        role: OrganizationRole.MEMBER,
      });

      await service.acceptProfInvite(user.id, multiInvite.id, multiInvite.code);
      await service.acceptProfInvite(
        user2.id,
        multiInvite.id,
        multiInvite.code,
      );

      const updated = await ProfInviteModel.findOneBy({
        id: multiInvite.id,
      });
      expect(updated.usesUsed).toBe(2);

      // Third acceptance fails
      const user3 = await UserFactory.create();
      await OrganizationUserFactory.create({
        organizationUser: user3,
        organization: org,
        role: OrganizationRole.MEMBER,
      });
      const url = await service.acceptProfInvite(
        user3.id,
        multiInvite.id,
        multiInvite.code,
      );
      expect(url).toContain(QUERY_PARAMS.profInvite.error.maxUsesReached);
    });

    it('Invalid Invite ID: Returns NotFound error', async () => {
      // capture console.error to capture the error
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const url = await service.acceptProfInvite(user.id, 99999, 'abc');
      expect(url).toContain(QUERY_PARAMS.profInvite.error.notFound);
      expectEmailNotSent();
      consoleErrorSpy.mockRestore();
    });

    it('User Not Found: Returns UserNotFound error', async () => {
      const url = await service.acceptProfInvite(99999, invite.id, invite.code);
      expect(url).toContain(QUERY_PARAMS.profInvite.error.userNotFound);
      expectEmailNotSent();
    });

    it('Expired Invite: Returns Expired error and emails admin', async () => {
      const expiredInvite = await service.createProfInvite(
        org.id,
        course.id,
        admin.id,
        1,
        new Date(Date.now() - 10000), // Past
      );

      const url = await service.acceptProfInvite(
        user.id,
        expiredInvite.id,
        expiredInvite.code,
      );
      expect(url).toContain(QUERY_PARAMS.profInvite.error.expired);
      const fullInvite = await findInviteWithRelations(expiredInvite.id);
      const email = service.constructExpiredEmail(
        user,
        fullInvite,
        fullInvite.code,
      );
      expectEmailSent(
        [admin.email],
        [MailServiceType.ADMIN_NOTICE],
        email.subject,
        email.content,
      );
    });

    it('Max Uses Reached: Returns error and emails admin', async () => {
      // Artificially use it up
      invite.usesUsed = 1;
      await invite.save();

      const url = await service.acceptProfInvite(
        user.id,
        invite.id,
        invite.code,
      );
      expect(url).toContain(QUERY_PARAMS.profInvite.error.maxUsesReached);
      const fullInvite = await findInviteWithRelations(invite.id);
      const email = service.constructAlreadyUsedEmail(
        user,
        fullInvite,
        fullInvite.code,
      );
      expectEmailSent(
        [admin.email],
        [MailServiceType.ADMIN_NOTICE],
        email.subject,
        email.content,
      );
    });

    it('Bad Code: Returns BadCode error and emails admin', async () => {
      const url = await service.acceptProfInvite(
        user.id,
        invite.id,
        'WRONG_CODE',
      );
      expect(url).toContain(QUERY_PARAMS.profInvite.error.badCode);
      const fullInvite = await findInviteWithRelations(invite.id);
      const email = service.constructWrongCodeEmail(
        user,
        fullInvite,
        'WRONG_CODE',
      );
      expectEmailSent(
        [admin.email],
        [MailServiceType.ADMIN_NOTICE],
        email.subject,
        email.content,
      );
    });

    it('User is Student: Does NOT consume invite, sends manual promotion email', async () => {
      // Add user as student
      await UserCourseFactory.create({
        user,
        course,
        role: Role.STUDENT,
      });

      const url = await service.acceptProfInvite(
        user.id,
        invite.id,
        invite.code,
      );

      // Should just redirect to course
      expect(url).toBe(`/course/${course.id}`);

      // Invite not used
      const updated = await ProfInviteModel.findOneBy({ id: invite.id });
      expect(updated.usesUsed).toBe(0);

      const fullInvite = await findInviteWithRelations(invite.id);
      const email = service.constructAlreadyStudentEmail(
        user,
        fullInvite,
        fullInvite.code,
      );
      expectEmailSent(
        [admin.email],
        [MailServiceType.ADMIN_NOTICE],
        email.subject,
        email.content,
      );
    });

    it('User is already Professor: Redirects immediately, no email, no consume', async () => {
      await UserCourseFactory.create({
        user,
        course,
        role: Role.PROFESSOR,
      });

      const url = await service.acceptProfInvite(
        user.id,
        invite.id,
        invite.code,
      );

      expect(url).toBe(`/course/${course.id}`);
      const updated = await ProfInviteModel.findOneBy({ id: invite.id });
      expect(updated.usesUsed).toBe(0);
      expectEmailNotSent();
    });

    it('Admin accepts own invite (New to course): Adds to course, Invite NOT consumed', async () => {
      // Admin creates invite, is NOT in course yet
      const url = await service.acceptProfInvite(
        admin.id,
        invite.id,
        invite.code,
      );

      expect(url).toContain(
        QUERY_PARAMS.profInvite.notice.adminAcceptedInviteNotConsumed,
      );

      // Admin added
      const uc = await UserCourseModel.findOne({
        where: { userId: admin.id, courseId: course.id },
      });
      expect(uc.role).toBe(Role.PROFESSOR);

      // Not consumed
      const updated = await ProfInviteModel.findOneBy({ id: invite.id });
      expect(updated.usesUsed).toBe(0);

      // No email sent because admin is the creator
      expectEmailNotSent();
    });

    it('Admin accepts own invite (Already in course): Returns notice, no DB changes', async () => {
      await UserCourseFactory.create({
        user: admin,
        course,
        role: Role.PROFESSOR,
      });

      const url = await service.acceptProfInvite(
        admin.id,
        invite.id,
        invite.code,
      );

      expect(url).toContain(
        QUERY_PARAMS.profInvite.notice.adminAlreadyInCourse,
      );
      const updated = await ProfInviteModel.findOneBy({ id: invite.id });
      expect(updated.usesUsed).toBe(0);
      expectEmailNotSent();
    });

    it('Other Admin accepts invite: Added to course, Invite NOT consumed, Creator emailed', async () => {
      const otherAdmin = await UserFactory.create();
      await OrganizationUserFactory.create({
        organizationUser: otherAdmin,
        organization: org,
        role: OrganizationRole.ADMIN,
      });

      const url = await service.acceptProfInvite(
        otherAdmin.id,
        invite.id,
        invite.code,
      );

      expect(url).toContain(
        QUERY_PARAMS.profInvite.notice.adminAcceptedInviteNotConsumed,
      );

      const uc = await UserCourseModel.findOne({
        where: { userId: otherAdmin.id, courseId: course.id },
      });
      expect(uc.role).toBe(Role.PROFESSOR);

      const updated = await ProfInviteModel.findOneBy({ id: invite.id });
      expect(updated.usesUsed).toBe(0);

      // Creator (admin) should be notified that another admin clicked it
      const fullInvite = await findInviteWithRelations(invite.id);
      const email = service.constructAdminAcceptedEmail(
        otherAdmin,
        fullInvite,
        fullInvite.code,
      );
      expectEmailSent(
        [admin.email],
        [MailServiceType.ADMIN_NOTICE],
        email.subject,
        email.content,
      );
    });
  });
});
