import { antdTagColor, OrganizationRole, SemesterPartial } from '@koh/common';
import { setupIntegrationTest } from './util/testUtils';
import { SemesterModule } from '../src/semester/semester.module';
import {
  OrganizationFactory,
  OrganizationSettingsFactory,
  OrganizationUserFactory,
  SemesterFactory,
} from './util/factories';
import { SemesterModel } from '../src/semester/semester.entity';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { UserModel } from '../src/profile/user.entity';
import { OrganizationModel } from '../src/organization/organization.entity';

describe('SemesterController Integration', () => {
  const { supertest } = setupIntegrationTest(SemesterModule);
  let orgUser: OrganizationUserModel;
  let semester1: SemesterModel;
  let semester2: SemesterModel;

  beforeEach(async () => {
    await SemesterModel.delete({});
    await OrganizationUserModel.delete({});
    await UserModel.delete({});
    await OrganizationModel.delete({});
  });

  describe('GET /semesters/:oid', () => {
    it('should return semesters for a valid organization', async () => {
      orgUser = await OrganizationUserFactory.create({
        role: OrganizationRole.ADMIN,
      });
      semester1 = await SemesterFactory.create({
        name: 'Fall 2021',
        organization: orgUser.organization,
      });
      semester2 = await SemesterFactory.create({
        name: 'Fall 2022',
        organization: orgUser.organization,
      });

      const res = await supertest({ userId: orgUser.organizationUser.id })
        .get(`/semesters/${orgUser.organization.id}`)
        .expect(200);

      // Ensure the response is an array and contains our semesters
      expect(Array.isArray(res.body)).toBe(true);
      const names = res.body.map((s: SemesterPartial) => s.name);
      expect(names).toContain(semester1.name);
      expect(names).toContain(semester2.name);
    });

    it('should return 401 if organization is not found', async () => {
      orgUser = await OrganizationUserFactory.create({
        role: OrganizationRole.ADMIN,
      });

      await supertest({ userId: orgUser.organizationUser.id })
        .get(`/semesters/99999`)
        .expect(401);
    });

    it('should not allow users outside the organization to get semesters', async () => {
      orgUser = await OrganizationUserFactory.create({
        role: OrganizationRole.ADMIN,
      });
      const otherOrgUser = await OrganizationUserFactory.create({
        role: OrganizationRole.MEMBER,
      });

      await supertest({ userId: otherOrgUser.organizationUser.id })
        .get(`/semesters/${orgUser.organization.id}`)
        .expect(401);
    });

    it('should return 401 for if user is not logged in', async () => {
      const org = await OrganizationFactory.create();
      await supertest().get(`/semesters/${org.id}`).expect(401);
    });
  });

  describe('POST /semesters/:oid', () => {
    it('should create a new semester for a valid organization', async () => {
      const orgUser = await OrganizationUserFactory.create({
        role: OrganizationRole.ADMIN,
      });
      const semesterDetails = {
        name: 'Summer 2022',
        // Using ISO strings for dates so they can be transformed into Date objects by the DTO
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
        description: 'A test semester',
        color: 'blue',
      };

      const res = await supertest({ userId: orgUser.organizationUser.id })
        .post(`/semesters/${orgUser.organization.id}`)
        .send(semesterDetails)
        .expect(201);

      const createdSemester = await SemesterModel.findOne({
        where: {
          name: semesterDetails.name,
          organizationId: orgUser.organization.id,
        },
      });
      expect(createdSemester).toBeDefined();
      expect(createdSemester.color).toEqual(semesterDetails.color);
      expect(createdSemester.description).toEqual(semesterDetails.description);
      expect(createdSemester.organizationId).toEqual(orgUser.organization.id);
      expect(createdSemester.name).toEqual(semesterDetails.name);
    });

    it('should return 401 if organization is not found', async () => {
      const semesterDetails = {
        name: 'Summer 2022',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
        description: 'A test semester',
      };
      await supertest({ userId: 1 })
        .post(`/semesters/99999`)
        .send(semesterDetails)
        .expect(401);
    });

    it("should return 401 if user is a professor and organization doesn't allow professors to create semesters", async () => {
      const organization = await OrganizationFactory.create();
      const orgUser = await OrganizationUserFactory.create({
        organizationId: organization.id,
        organization,
        role: OrganizationRole.PROFESSOR,
      });
      await OrganizationSettingsFactory.create({
        organizationId: organization.id,
        organization,
        allowProfCourseCreate: false,
      });
      await supertest({ userId: orgUser.userId })
        .post(`/semesters/${organization.id}`)
        .send({
          name: 'n',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          description: 'd',
          color: antdTagColor.blue,
        })
        .expect(401);
    });
  });

  describe('PATCH /semesters/:oid/:sid', () => {
    it('should update an existing semester', async () => {
      orgUser = await OrganizationUserFactory.create({
        role: OrganizationRole.ADMIN,
      });
      semester1 = await SemesterFactory.create({
        name: 'Fall 2021',
        organization: orgUser.organization,
      });

      const updatedDetails = {
        name: 'Fall 2021 Updated',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
        description: 'Updated semester description',
        color: 'blue',
      };

      const res = await supertest({ userId: orgUser.organizationUser.id })
        .patch(`/semesters/${orgUser.organization.id}/${semester1.id}`)
        .send(updatedDetails)
        .expect(200);

      expect(res.text).toEqual('Semester updated successfully');

      const updatedSemester = await SemesterModel.findOne({
        where: { id: semester1.id },
      });
      expect(updatedSemester.name).toEqual(updatedDetails.name);
      expect(updatedSemester.color).toEqual(updatedDetails.color);
      expect(updatedSemester.description).toEqual(updatedDetails.description);
    });

    it('should return 400 if semester is not found', async () => {
      orgUser = await OrganizationUserFactory.create({
        role: OrganizationRole.ADMIN,
      });

      const updatedDetails = {
        name: 'Fall 2021 Updated',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
        description: 'Updated semester description',
      };

      await supertest({ userId: orgUser.organizationUser.id })
        .patch(`/semesters/${orgUser.organization.id}/99999`)
        .send(updatedDetails)
        .expect(400);
    });

    it("should return 403 if user is a professor and organization doesn't allow professors to update semesters", async () => {
      const organization = await OrganizationFactory.create();
      const orgUser = await OrganizationUserFactory.create({
        organizationId: organization.id,
        organization,
        role: OrganizationRole.PROFESSOR,
      });
      await OrganizationSettingsFactory.create({
        organizationId: organization.id,
        organization,
        allowProfCourseCreate: false,
      });
      await supertest({ userId: orgUser.userId })
        .patch(`/semesters/${organization.id}/1`)
        .send({
          name: 'n',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          description: 'd',
          color: antdTagColor.blue,
        })
        .expect(403);
    });
  });

  describe('DELETE /semesters/:oid/:sid', () => {
    it('should delete an existing semester', async () => {
      orgUser = await OrganizationUserFactory.create({
        role: OrganizationRole.ADMIN,
      });
      semester1 = await SemesterFactory.create({
        name: 'Spring 2022',
        organization: orgUser.organization,
      });

      const res = await supertest({ userId: orgUser.organizationUser.id })
        .delete(`/semesters/${orgUser.organization.id}/${semester1.id}`)
        .expect(200);
      expect(res.text).toEqual('Semester deleted successfully');

      const deletedSemester = await SemesterModel.findOne({
        where: { id: semester1.id },
      });
      expect(deletedSemester).toBeNull();
    });

    it('should return 400 if semester is not found', async () => {
      orgUser = await OrganizationUserFactory.create({
        role: OrganizationRole.ADMIN,
      });
      await supertest({ userId: 1 })
        .delete(`/semesters/${orgUser.organization.id}/99999`)
        .expect(400);
    });

    it("should return 403 if user is a professor and organization doesn't allow professors to delete semesters", async () => {
      const orgUser = await OrganizationUserFactory.create({
        role: OrganizationRole.PROFESSOR,
      });
      await OrganizationSettingsFactory.create({
        organizationId: orgUser.organizationId,
        organization: orgUser.organization,
        allowProfCourseCreate: false,
      });
      await supertest({ userId: orgUser.userId })
        .delete(`/semesters/${orgUser.organizationUser.id}/1`)
        .expect(403);
    });
  });
});
