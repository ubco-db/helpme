import { JwtService } from '@nestjs/jwt';
import { Role } from '@koh/common';
import * as jwt from 'jsonwebtoken';
import { LtiModule } from '../src/lti/lti.module';
import { restrictPaths } from '../src/lti/lti-auth.controller';
import {
  CourseFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';

describe('App and LTI session cookie coexistence', () => {
  const { supertest, getTestModule } = setupIntegrationTest(LtiModule);

  let jwtService: JwtService;
  beforeEach(() => {
    jwtService = getTestModule().get<JwtService>(JwtService);
  });

  const setupProfessor = async () => {
    const professor = await UserFactory.create();
    const course = await CourseFactory.create();
    await UserCourseFactory.create({
      user: professor,
      course,
      role: Role.PROFESSOR,
    });
    return { professor, course };
  };

  const setupProfessorAndStudent = async () => {
    const { professor, course } = await setupProfessor();
    const student = await UserFactory.create();
    await UserCourseFactory.create({
      user: student,
      course,
      role: Role.STUDENT,
    });
    return { professor, student, course };
  };

  const signLtiSession = (userId: number): string =>
    jwtService.sign({ userId, restrictPaths });

  const expectLtiQuestionList = (
    cookies: string[],
    course: { id: number },
    status: number,
  ) =>
    supertest()
      .get(`/lti/embeddable-question/${course.id}`)
      .set('Cookie', cookies)
      .expect(status);

  const expiredAppToken = (userId: number): string =>
    jwtService.sign({ userId }, { expiresIn: -60 });
  // Signed with a different secret, so its signature does not verify
  const forgedAppToken = (userId: number): string =>
    jwt.sign({ userId }, 'not-the-jwt-secret');

  const invalidAppCookies: Array<[string, (userId: number) => string]> = [
    ['an expired token', expiredAppToken],
    ['a token with a bad signature', forgedAppToken],
  ];

  it('accepts an existing app session from before this branch', async () => {
    const { professor, course } = await setupProfessor();
    const existingSession = jwtService.sign({
      userId: professor.id,
      expiresIn: 60 * 60 * 24 * 30,
    });

    await expectLtiQuestionList([`auth_token=${existingSession}`], course, 200);
  });

  it.each(invalidAppCookies)(
    'falls back to a fresh LTI session when the app cookie is %s',
    async (_name, makeAppToken) => {
      const { professor, course } = await setupProfessor();
      const ltiSession = signLtiSession(professor.id);

      // The invalid cookie alone still grants nothing...
      await expectLtiQuestionList(
        [`auth_token=${makeAppToken(professor.id)}`],
        course,
        401,
      );

      // ...but it no longer shadows the fresh LTI session
      await expectLtiQuestionList(
        [
          `auth_token=${makeAppToken(professor.id)}`,
          `lti_auth_token=${ltiSession}`,
        ],
        course,
        200,
      );
    },
  );

  it('rejects a request with no valid session cookie', async () => {
    const { professor, course } = await setupProfessor();
    const expiredLtiSession = jwtService.sign(
      { userId: professor.id, restrictPaths },
      { expiresIn: -60 },
    );

    // Expired cookies of both kinds grant nothing...
    await expectLtiQuestionList(
      [
        `auth_token=${expiredAppToken(professor.id)}`,
        `lti_auth_token=${expiredLtiSession}`,
      ],
      course,
      401,
    );

    // ...and neither does the absence of any cookie
    await supertest().get(`/lti/embeddable-question/${course.id}`).expect(401);
  });

  it('keeps the selected LTI session path restrictions when the app cookie is invalid', async () => {
    const { professor, course } = await setupProfessor();

    // An LTI session restricted to the profile API cannot list staff questions
    const restrictedLtiSession = jwtService.sign({
      userId: professor.id,
      restrictPaths: ['r^\\/api\\/v1\\/profile$'],
    });

    await expectLtiQuestionList(
      [
        `auth_token=${expiredAppToken(professor.id)}`,
        `lti_auth_token=${restrictedLtiSession}`,
      ],
      course,
      403,
    );
  });

  it('still prefers a valid ordinary app session over the LTI session cookie', async () => {
    const { professor, student, course } = await setupProfessorAndStudent();
    const appSession = jwtService.sign({
      userId: professor.id,
    });
    // An LTI session for a student could not list staff questions, so a 200
    // proves the ordinary app session took precedence.
    const studentLtiSession = signLtiSession(student.id);

    await expectLtiQuestionList(
      [`auth_token=${appSession}`, `lti_auth_token=${studentLtiSession}`],
      course,
      200,
    );
  });
});
