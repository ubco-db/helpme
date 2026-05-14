import {
  StudentCourseFactory,
  UserFactory,
  CourseFactory,
  OrganizationFactory,
  ChatTokenFactory,
  AsyncQuestionFactory,
  AsyncQuestionCommentFactory,
  CourseSettingsFactory,
  UserCourseFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { ProfileModule } from '../src/profile/profile.module';
import { DesktopNotifModel } from 'notification/desktop-notif.entity';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { AccountType, OrganizationRole, Role } from '@koh/common';
import { CourseModel } from 'course/course.entity';
import { UserModel } from 'profile/user.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

describe('Profile Integration', () => {
  const { supertest } = setupIntegrationTest(ProfileModule);

  describe('GET /profile', () => {
    it('returns the logged-in user profile', async () => {
      const organization = await OrganizationFactory.create();
      const user = await UserFactory.create();
      const fundies = await CourseFactory.create({ name: 'CS 2500' });
      await StudentCourseFactory.create({ course: fundies, user });
      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      await ChatTokenFactory.create({ user, token: 'test' });

      const res = await supertest({ userId: user.id })
        .get('/profile')
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });

    it('returns account deactivated error', async () => {
      const user = await UserFactory.create({ accountDeactivated: true });
      await supertest({ userId: user.id }).get('/profile').expect(403);
    });

    it('returns only userCourses where course is enabled', async () => {
      const user = await UserFactory.create();
      const fundies = await CourseFactory.create({ name: 'CS 2500' });
      const nonEnabledCourse = await CourseFactory.create({
        name: 'CS 4900',
        enabled: false,
      });
      await StudentCourseFactory.create({ course: fundies, user });
      await StudentCourseFactory.create({ course: nonEnabledCourse, user });

      const res = await supertest({ userId: user.id })
        .get('/profile')
        .expect(200);

      expect(res.body.courses).toEqual([
        {
          course: {
            id: 1,
            name: 'CS 2500',
            enabled: true,
            sectionGroupName: '001',
            semesterId: 1,
          },
          favourited: true,
          role: 'student',
        },
      ]);
    });

    it('returns desktop notif information', async () => {
      const user = await UserFactory.create();
      const dn = await DesktopNotifModel.create({
        userId: user.id,
        auth: '',
        p256dh: '',
        endpoint: 'abc',
        name: 'firefox',
      }).save();

      const res = await supertest({ userId: user.id })
        .get('/profile')
        .expect(200);
      expect(res.body.desktopNotifs).toEqual([
        {
          createdAt: expect.any(String),
          name: 'firefox',
          id: dn.id,
          endpoint: dn.endpoint,
        },
      ]);
    });

    it('returns 401 when not logged in', async () => {
      await UserFactory.create();
      await supertest().get('/profile').expect(401);
    });
  });

  describe('DELETE /profile/delete_profile_picture', () => {
    it("should delete profile picture from database only if it's URL", async () => {
      const user = await UserFactory.create({
        photoURL: 'https://www.google.com',
      });
      await supertest({ userId: user.id })
        .delete('/profile/delete_profile_picture')
        .expect(200);
    });
  });

  describe('PATCH /profile', () => {
    it('enables desktop notifs', async () => {
      const user = await UserFactory.create({
        desktopNotifsEnabled: false,
      });
      const res = await supertest({ userId: user.id })
        .patch('/profile')
        .send({ desktopNotifsEnabled: true })
        .expect(200);
      expect(res.body).toMatchObject({
        message: 'Profile updated successfully',
      });
    });

    it('should not update profile settings if email is included and account is not legacy', async () => {
      const user = await UserFactory.create({
        email: 'test@ubc.ca',
        accountType: AccountType.GOOGLE,
      });

      const res = await supertest({ userId: user.id })
        .patch('/profile')
        .send({ email: 'test@ubc.ca', firstName: 'test' });

      expect(res.status).toEqual(400);
      expect(res.body).toEqual({
        message: 'Email cannot be updated',
      });
    });

    it('lets ta change default teams message', async () => {
      const user = await UserFactory.create();
      let profile = await supertest({ userId: user.id }).get('/profile');
      expect(profile.body?.defaultMessage).toEqual(null);
      await supertest({ userId: user.id })
        .patch('/profile')
        .send({ defaultMessage: "Hello! It's me :D" })
        .expect(200);
      profile = await supertest({ userId: user.id }).get('/profile');
      expect(profile.body?.defaultMessage).toEqual("Hello! It's me :D");
    });

    it('lets ta change includeDefaultMessage', async () => {
      const user = await UserFactory.create();
      let profile = await supertest({ userId: user.id }).get('/profile');
      expect(profile.body?.includeDefaultMessage).toEqual(true);
      await supertest({ userId: user.id })
        .patch('/profile')
        .send({ includeDefaultMessage: false })
        .expect(200);
      profile = await supertest({ userId: user.id }).get('/profile');
      expect(profile.body?.includeDefaultMessage).toEqual(false);
    });

    it('lets user change email', async () => {
      const user = await UserFactory.create();
      let profile = await supertest({ userId: user.id }).get('/profile');
      const newEmail = 'new_test_email@ubc.ca';

      expect(profile.body?.email).toEqual(user.email);
      await supertest({ userId: user.id })
        .patch('/profile')
        .send({ email: newEmail })
        .expect(200);

      profile = await supertest({ userId: user.id }).get('/profile');
      expect(profile.body?.email).toEqual(newEmail);
    });

    it('fails to change user email when email is used by another user', async () => {
      const user = await UserFactory.create();
      await UserFactory.create({ email: 'test@ubc.ca' });

      await supertest({ userId: user.id })
        .patch('/profile')
        .send({ email: 'test@ubc.ca' })
        .expect(400);
    });
  });

  describe('GET /profile/get_pfp/:requestUserId/:photoURL', () => {
    const TEST_PHOTO = 'test-pfp.webp';
    const uploadDir = process.env.UPLOAD_LOCATION || './uploads';

    // Create a tiny valid file so res.sendFile doesn't fail
    beforeAll(() => {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, TEST_PHOTO), Buffer.from([0x00]));
    });

    afterAll(() => {
      try {
        fs.unlinkSync(path.join(uploadDir, TEST_PHOTO));
      } catch {
        // ignore cleanup errors
      }
    });

    /**
     * helper function that creates an org, two users with their org memberships,
     * and optionally enrolls them in a shared course.
     */
    async function setupScenario(opts: {
      requesterOrgRole?: OrganizationRole;
      requesteeOrgRole?: OrganizationRole;
      sameOrg?: boolean;
      sharedCourse?: {
        requesterRole: Role;
        requesteeRole: Role;
      };
      requesteePhotoURL?: string | null;
    }) {
      const org = await OrganizationFactory.create();
      const org2 =
        opts.sameOrg === false ? await OrganizationFactory.create() : org;

      const requester = await UserFactory.create();
      const requestee = await UserFactory.create({
        photoURL:
          opts.requesteePhotoURL !== undefined
            ? opts.requesteePhotoURL
            : TEST_PHOTO,
      });

      await OrganizationUserModel.create({
        userId: requester.id,
        organizationId: org.id,
        role: opts.requesterOrgRole ?? OrganizationRole.MEMBER,
      }).save();
      await OrganizationUserModel.create({
        userId: requestee.id,
        organizationId: org2.id,
        role: opts.requesteeOrgRole ?? OrganizationRole.MEMBER,
      }).save();

      let course: CourseModel | undefined;
      if (opts.sharedCourse) {
        course = await CourseFactory.create();
        await UserCourseFactory.create({
          user: requester,
          course,
          role: opts.sharedCourse.requesterRole,
        });
        await UserCourseFactory.create({
          user: requestee,
          course,
          role: opts.sharedCourse.requesteeRole,
        });
      }

      return { org, org2, requester, requestee, course };
    }

    it('returns 401 for unauthenticated requests', async () => {
      const { requestee } = await setupScenario({});
      await supertest()
        .get(`/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`)
        .expect(401);
    });
    it('returns 404 when the requested user does not exist', async () => {
      const { requester } = await setupScenario({});
      await supertest({ userId: requester.id })
        .get(`/profile/get_pfp/99999/${TEST_PHOTO}`)
        .expect(404);
    });
    it('returns 404 when the requested user has no profile picture', async () => {
      const { requester, requestee } = await setupScenario({
        requesteePhotoURL: null,
      });
      await supertest({ userId: requester.id })
        .get(`/profile/get_pfp/${requestee.id}/anything.webp`)
        .expect(404);
    });
    it("returns 404 when the photoURL param does not match the user's actual photoURL", async () => {
      const { requester, requestee } = await setupScenario({});
      await supertest({ userId: requester.id })
        .get(`/profile/get_pfp/${requestee.id}/wrong-photo.webp`)
        .expect(404);
    });

    it('allows a user to view their own profile picture', async () => {
      const org = await OrganizationFactory.create();
      const user = await UserFactory.create({ photoURL: TEST_PHOTO });
      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: org.id,
        role: OrganizationRole.MEMBER,
      }).save();

      const res = await supertest({ userId: user.id }).get(
        `/profile/get_pfp/${user.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });

    //
    //  Org-level permissions
    //

    it("allows an org admin to view any member's pfp in the same org", async () => {
      const { requester, requestee } = await setupScenario({
        requesterOrgRole: OrganizationRole.ADMIN,
        requesteeOrgRole: OrganizationRole.MEMBER,
        sameOrg: true,
      });
      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });
    it("allows any org member to view an org professor's pfp in the same org", async () => {
      const { requester, requestee } = await setupScenario({
        requesterOrgRole: OrganizationRole.MEMBER,
        requesteeOrgRole: OrganizationRole.PROFESSOR,
        sameOrg: true,
      });
      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });
    it("allows any org member to view an org admin's pfp in the same org", async () => {
      const { requester, requestee } = await setupScenario({
        requesterOrgRole: OrganizationRole.MEMBER,
        requesteeOrgRole: OrganizationRole.ADMIN,
        sameOrg: true,
      });
      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });
    it('denies an org admin viewing a user in a different org', async () => {
      const { requester, requestee } = await setupScenario({
        requesterOrgRole: OrganizationRole.ADMIN,
        requesteeOrgRole: OrganizationRole.MEMBER,
        sameOrg: false,
      });
      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(403);
    });
    it('denies a member from viewing an org professor in a different org', async () => {
      const { requester, requestee } = await setupScenario({
        requesterOrgRole: OrganizationRole.MEMBER,
        requesteeOrgRole: OrganizationRole.PROFESSOR,
        sameOrg: false,
      });
      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(403);
    });
    it("denies two members in the same org with no shared course from viewing each other's pfp", async () => {
      const { requester, requestee } = await setupScenario({
        requesterOrgRole: OrganizationRole.MEMBER,
        requesteeOrgRole: OrganizationRole.MEMBER,
        sameOrg: true,
      });
      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(403);
    });

    //
    //  Course-level permissions
    //

    it("allows a TA in a shared course to view a student's pfp", async () => {
      const { requester, requestee } = await setupScenario({
        sameOrg: true,
        sharedCourse: { requesterRole: Role.TA, requesteeRole: Role.STUDENT },
      });
      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });
    it("allows a professor in a shared course to view a student's pfp", async () => {
      const { requester, requestee } = await setupScenario({
        sameOrg: true,
        sharedCourse: {
          requesterRole: Role.PROFESSOR,
          requesteeRole: Role.STUDENT,
        },
      });
      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });
    it("allows a student in a shared course to view a TA's pfp", async () => {
      const { requester, requestee } = await setupScenario({
        sameOrg: true,
        sharedCourse: { requesterRole: Role.STUDENT, requesteeRole: Role.TA },
      });
      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });
    it("allows a student in a shared course to view a professor's pfp", async () => {
      const { requester, requestee } = await setupScenario({
        sameOrg: true,
        sharedCourse: {
          requesterRole: Role.STUDENT,
          requesteeRole: Role.PROFESSOR,
        },
      });
      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });

    //
    //  Student-to-student
    //

    it("denies student viewing another student's pfp when they share a course (requestee has no non-anonymous content)", async () => {
      const { requester, requestee } = await setupScenario({
        sameOrg: true,
        sharedCourse: {
          requesterRole: Role.STUDENT,
          requesteeRole: Role.STUDENT,
        },
      });

      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(403);
    });
    it("denies student viewing another student's pfp when requestee only has anonymous async questions", async () => {
      const { requester, requestee, course } = await setupScenario({
        sameOrg: true,
        sharedCourse: {
          requesterRole: Role.STUDENT,
          requesteeRole: Role.STUDENT,
        },
      });

      // Create a hidden anonymous question
      await AsyncQuestionFactory.create({
        creator: requestee,
        course,
        isAnonymous: true,
      });

      const res1 = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res1.status).toBe(403);

      // Create a visible anonymous question
      await AsyncQuestionFactory.create({
        creator: requestee,
        course,
        staffSetVisible: true,
        authorSetVisible: true,
        isAnonymous: true,
      });
      const res2 = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res2.status).toBe(403);
    });
    it("allows student to view another student's pfp when requestee has a non-anonymous, visible async question (staffSetVisible)", async () => {
      const { requester, requestee, course } = await setupScenario({
        sameOrg: true,
        sharedCourse: {
          requesterRole: Role.STUDENT,
          requesteeRole: Role.STUDENT,
        },
      });

      // CourseSettings with asyncCentreAuthorPublic: false (default)
      // means isVisible only checks staffSetVisible
      await CourseSettingsFactory.create({
        course,
        asyncCentreAuthorPublic: false,
      });

      await AsyncQuestionFactory.create({
        creator: requestee,
        course,
        isAnonymous: false,
        staffSetVisible: true,
      });

      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });
    it("allows student to view another student's pfp when requestee has a non-anonymous async question with authorSetVisible and asyncCentreAuthorPublic enabled", async () => {
      const { requester, requestee, course } = await setupScenario({
        sameOrg: true,
        sharedCourse: {
          requesterRole: Role.STUDENT,
          requesteeRole: Role.STUDENT,
        },
      });

      // Enable asyncCentreAuthorPublic so authorSetVisible is respected when staffSetVisible is null
      await CourseSettingsFactory.create({
        course,
        asyncCentreAuthorPublic: true,
      });

      await AsyncQuestionFactory.create({
        creator: requestee,
        course,
        isAnonymous: false,
        staffSetVisible: null,
        authorSetVisible: true,
      });

      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });
    it("denies student viewing another student's pfp when requestee has non-anonymous question but it is not visible", async () => {
      const { requester, requestee, course } = await setupScenario({
        sameOrg: true,
        sharedCourse: {
          requesterRole: Role.STUDENT,
          requesteeRole: Role.STUDENT,
        },
      });

      await CourseSettingsFactory.create({
        course,
        asyncCentreAuthorPublic: false,
      });

      // staffSetVisible is null and asyncCentreAuthorPublic is false -> not visible
      await AsyncQuestionFactory.create({
        creator: requestee,
        course,
        isAnonymous: false,
        staffSetVisible: null,
        authorSetVisible: true,
      });

      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(403);
    });
    it("allows student to view another student's pfp when requestee has a non-anonymous comment in a shared course", async () => {
      const { requester, requestee, course } = await setupScenario({
        sameOrg: true,
        sharedCourse: {
          requesterRole: Role.STUDENT,
          requesteeRole: Role.STUDENT,
        },
      });

      // Create a question in the course (can belong to anyone)
      const question1 = await AsyncQuestionFactory.create({
        creator: requester,
        course,
      });
      const question2 = await AsyncQuestionFactory.create({
        creator: requester,
        course,
      });

      // Requestee leaves a non-anonymous comment
      await AsyncQuestionCommentFactory.create({
        creator: requestee,
        question: question1,
        isAnonymous: false,
      });
      await AsyncQuestionCommentFactory.create({
        creator: requestee,
        question: question2,
        isAnonymous: true, // make a second comment that is anonymous. Should still work, just need 1 to be non-anonymous
      });

      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(200);
    });
    it("denies student viewing another student's pfp when requestee only has anonymous comments", async () => {
      const { requester, requestee, course } = await setupScenario({
        sameOrg: true,
        sharedCourse: {
          requesterRole: Role.STUDENT,
          requesteeRole: Role.STUDENT,
        },
      });

      const question = await AsyncQuestionFactory.create({
        creator: requester,
        course,
      });

      // Requestee leaves an anonymous comment
      await AsyncQuestionCommentFactory.create({
        creator: requestee,
        question,
        isAnonymous: true,
      });

      const res = await supertest({ userId: requester.id }).get(
        `/profile/get_pfp/${requestee.id}/${TEST_PHOTO}`,
      );
      expect(res.status).toBe(403);
    });
  });

  describe('POST /profile/upload_picture', () => {
    // Real image buffers generated by sharp (valid enough for file-type detection AND sharp processing)
    const REAL_IMAGES: Record<string, Buffer> = {};

    beforeAll(async () => {
      const pixel = sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      });
      REAL_IMAGES.JPEG = await pixel.clone().jpeg().toBuffer();
      REAL_IMAGES.PNG = await pixel.clone().png().toBuffer();
      REAL_IMAGES.GIF = await pixel.clone().gif().toBuffer();
      REAL_IMAGES.WEBP = await pixel.clone().webp().toBuffer();
    });

    // Raw magic-number stubs for REJECTION tests (intentionally incomplete/invalid)
    const MAGIC = {
      PDF: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
      EXE: Buffer.from([0x4d, 0x5a]), // MZ
      ZIP: Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK
      SVG_TEXT: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      JPEG_STUB: Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
      ]),
      PNG_STUB: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    };

    /** Pads a magic-number buffer to a given byte length (zero-filled). */
    function padBuffer(magic: Buffer, totalBytes: number): Buffer {
      if (totalBytes <= magic.length) return magic;
      return Buffer.concat([magic, Buffer.alloc(totalBytes - magic.length)]);
    }

    it('returns 401 when no auth token is provided', async () => {
      await supertest()
        .post('/profile/upload_picture')
        .attach('file', REAL_IMAGES.JPEG, 'photo.jpg')
        .expect(401);
    });

    it('returns 400 when no file is attached at all', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .send();
      expect(res.status).toBe(400);
    });
    it('returns 400 when the multipart field name is wrong (e.g. "image" instead of "file")', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('image', REAL_IMAGES.JPEG, 'photo.jpg');
      // FileInterceptor('file') ignores 'image' -> no file parsed -> validation fails
      expect(res.status).toBe(400);
    });

    it('rejects a file that exceeds the 5 MB limit', async () => {
      const user = await UserFactory.create();
      // Pad a real JPEG to 5 MB + 1 byte (append junk after real image data)
      const oversized = Buffer.concat([
        REAL_IMAGES.JPEG,
        Buffer.alloc(5 * 1024 * 1024 + 1 - REAL_IMAGES.JPEG.length),
      ]);

      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', oversized, {
          filename: 'huge.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
    });
    it('rejects a file that is exactly 5 MB (maxSize uses strict less-than)', async () => {
      const user = await UserFactory.create();
      // MaxFileSizeValidator uses `file.size < maxSize`, so exactly maxSize fails
      const exactLimit = Buffer.concat([
        REAL_IMAGES.JPEG,
        Buffer.alloc(5 * 1024 * 1024 - REAL_IMAGES.JPEG.length),
      ]);

      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', exactLimit, {
          filename: 'borderline.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
    });
    it('accepts a file that is 1 byte under the 5 MB limit (boundary)', async () => {
      const user = await UserFactory.create();
      const justUnder = Buffer.concat([
        REAL_IMAGES.JPEG,
        Buffer.alloc(5 * 1024 * 1024 - 1 - REAL_IMAGES.JPEG.length),
      ]);

      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', justUnder, {
          filename: 'almost5mb.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.status).toBe(201);
    });

    it('rejects a PDF file', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', MAGIC.PDF, {
          filename: 'report.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
    });
    it('rejects a ZIP archive', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', MAGIC.ZIP, {
          filename: 'archive.zip',
          contentType: 'application/zip',
        });

      expect(res.status).toBe(400);
    });
    it('rejects an EXE (Windows executable) even when disguised with a .jpg extension', async () => {
      const user = await UserFactory.create();
      // File content is an EXE (MZ header), but extension says .jpg
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', padBuffer(MAGIC.EXE, 1024), {
          filename: 'totally-a-photo.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
    });
    it('rejects an SVG file (XML-based, not in allowed list)', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', MAGIC.SVG_TEXT, {
          filename: 'icon.svg',
          contentType: 'image/svg+xml',
        });

      expect(res.status).toBe(400);
    });
    it('rejects a BMP image (valid image but not in the allowed list)', async () => {
      const user = await UserFactory.create();
      // BMP header: "BM" + file size (placeholder) + reserved + offset
      const bmpHeader = Buffer.from([
        0x42,
        0x4d, // "BM"
        0x46,
        0x00,
        0x00,
        0x00, // file size
        0x00,
        0x00,
        0x00,
        0x00, // reserved
        0x36,
        0x00,
        0x00,
        0x00, // pixel data offset
      ]);
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', padBuffer(bmpHeader, 512), {
          filename: 'image.bmp',
          contentType: 'image/bmp',
        });

      expect(res.status).toBe(400);
    });
    it('rejects a TIFF image (valid image but not in the allowed list)', async () => {
      const user = await UserFactory.create();
      // TIFF little-endian header
      const tiffHeader = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', padBuffer(tiffHeader, 512), {
          filename: 'scan.tiff',
          contentType: 'image/tiff',
        });

      expect(res.status).toBe(400);
    });

    it('allows upload when MIME says image/jpeg but magic bytes are actually PNG (validator only checks detected type against allow-list)', async () => {
      const user = await UserFactory.create();
      // The buffer is a real PNG, but the MIME/extension claim JPEG.
      // NestJS FileTypeValidator reads magic bytes -> detects image/png -> matches
      // against /jpg|jpeg|png|gif|avif|webp/, so png still matches. The validator
      // does NOT enforce MIME-to-magic consistency, only that the detected type
      // is in the allow-list.
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', REAL_IMAGES.PNG, {
          filename: 'sneaky.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.status).toBe(201);
    });
    it('rejects when extension is .jpg but content is a PDF (magic number reveals the truth)', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', padBuffer(MAGIC.PDF, 2048), {
          filename: 'document.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
    });
    it('accepts when MIME is application/octet-stream but the magic bytes are valid JPEG', async () => {
      const user = await UserFactory.create();
      // Some clients upload with generic octet-stream MIME. The validator detects
      // the real type from magic bytes, which matches the allow-list.
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', REAL_IMAGES.JPEG, {
          filename: 'photo.jpg',
          contentType: 'application/octet-stream',
        });

      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.status).toBe(201);
    });

    it('rejects a completely empty file (zero bytes)', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', Buffer.alloc(0), {
          filename: 'empty.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
    });
    it('rejects a file with only null bytes (no valid magic number)', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', Buffer.alloc(2048), {
          filename: 'zeroed.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
    });
    it('rejects a file with random garbage bytes (no recognisable magic number)', async () => {
      const user = await UserFactory.create();
      const garbage = Buffer.from(
        Array.from({ length: 256 }, () => Math.floor(Math.random() * 256)),
      );
      // Overwrite first 4 bytes to make sure they DON'T accidentally match any known magic
      garbage[0] = 0x01;
      garbage[1] = 0x02;
      garbage[2] = 0x03;
      garbage[3] = 0x04;

      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', garbage, {
          filename: 'random.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
    });
    it('rejects a file whose magic bytes are truncated (partial JPEG header)', async () => {
      const user = await UserFactory.create();
      // Only 2 bytes of a JPEG header - not enough for file-type to identify
      const partial = Buffer.from([0xff, 0xd8]);

      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', partial, {
          filename: 'truncated.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
    });

    it('accepts a file with no extension when the magic bytes are valid JPEG', async () => {
      const user = await UserFactory.create();
      // The validator checks magic bytes, not the filename extension
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', REAL_IMAGES.JPEG, {
          filename: 'noextension',
          contentType: 'image/jpeg',
        });

      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.status).toBe(201);
    });
    it('rejects a double-extension file (photo.jpg.exe) with EXE content', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', padBuffer(MAGIC.EXE, 512), {
          filename: 'photo.jpg.exe',
          contentType: 'application/x-msdownload',
        });

      expect(res.status).toBe(400);
    });
    it('handles a filename with special/unicode characters gracefully', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', REAL_IMAGES.JPEG, {
          filename: '日本語ファイル名 (copy).jpg', // server will rename this before saving anyway
          contentType: 'image/jpeg',
        });

      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.status).toBe(201);
    });

    it('successfully uploads a valid JPEG image', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', REAL_IMAGES.JPEG, {
          filename: 'portrait.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('fileName');
      expect(res.body.fileName).toMatch(/\.webp$/);

      // Verify the user record was updated
      const updatedUser = await UserModel.findOne({ where: { id: user.id } });
      expect(updatedUser.photoURL).toBe(res.body.fileName);
    });
    it('successfully uploads a valid PNG image', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', REAL_IMAGES.PNG, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('fileName');
      expect(res.body.fileName).toMatch(/\.webp$/);
    });

    it('successfully uploads a valid GIF image', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', REAL_IMAGES.GIF, {
          filename: 'animation.gif',
          contentType: 'image/gif',
        });

      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('fileName');
      expect(res.body.fileName).toMatch(/\.webp$/);
    });

    it('successfully uploads a valid WebP image', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', REAL_IMAGES.WEBP, {
          filename: 'modern.webp',
          contentType: 'image/webp',
        });

      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('fileName');
      expect(res.body.fileName).toMatch(/\.webp$/);
    });
    it('replaces a previous non-URL profile picture on re-upload', async () => {
      const user = await UserFactory.create({ photoURL: 'old-photo.webp' });

      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .attach('file', REAL_IMAGES.PNG, {
          filename: 'new-avatar.png',
          contentType: 'image/png',
        });

      expect(res.body.message).toBe('Image uploaded successfully');
      expect(res.status).toBe(201);
      expect(res.body.fileName).not.toBe('old-photo.webp');
      const updatedUser = await UserModel.findOne({ where: { id: user.id } });
      expect(updatedUser.photoURL).toBe(res.body.fileName);
    });
    it('rejects a request with Content-Type: application/json (no multipart form)', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .set('Content-Type', 'application/json')
        .send({ file: 'not-a-file' });

      // No file parsed by multer -> ParseFilePipe rejects
      expect(res.status).toBe(400);
    });
    it('rejects a text/plain body masquerading as an upload', async () => {
      const user = await UserFactory.create();
      const res = await supertest({ userId: user.id })
        .post('/profile/upload_picture')
        .set('Content-Type', 'text/plain')
        .send('this is definitely not an image');

      expect(res.status).toBe(400);
    });
  });
});
