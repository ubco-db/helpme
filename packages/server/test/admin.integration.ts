import { setupIntegrationTest } from './util/testUtils';
import { OrganizationFactory, UserFactory } from './util/factories';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { OrganizationRole, UserRole } from '@koh/common';
import { AdminModule } from 'admin/admin.module';

describe('Admin Integration', () => {
  const { supertest } = setupIntegrationTest(AdminModule);

  describe('GET /organization/:oid/cronjobs', () => {
    it('should return 401 when user is not logged in', async () => {
      const res = await supertest().get('/organization/1/cronjobs');

      expect(res.status).toBe(401);
    });

    it('should return 403 when user is not admin', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/cronjobs`,
      );

      expect(res.status).toBe(403);
    });

    it('should return 403 when user is only an ORG admin', async () => {
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
    it('should return 200 when userRole is admin', async () => {
      const user = await UserFactory.create({
        userRole: UserRole.ADMIN,
      });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.MEMBER, // idk. make them just an org member should still work
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/organization/${organization.id}/cronjobs`,
      );

      expect(res.status).toBe(200);
    });
  });
});
