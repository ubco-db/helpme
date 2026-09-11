import { JwtService } from '@nestjs/jwt';
import { Role } from '@koh/common';
import { LtiModule } from '../src/lti/lti.module';
import { APP_AUTH_KIND, LOGIN_ENTRY_KIND } from '../src/login/auth-token';
import { restrictPaths } from '../src/lti/lti-auth.controller';
import {
  CourseFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';

describe('JWT purpose isolation', () => {
  const { supertest, getTestModule } = setupIntegrationTest(LtiModule);

  it('does not accept a login-entry credential as an application session', async () => {
    const user = await UserFactory.create();
    const course = await CourseFactory.create();
    await UserCourseFactory.create({ user, course, role: Role.PROFESSOR });

    const loginEntryToken = getTestModule().get<JwtService>(JwtService).sign(
      {
        kind: LOGIN_ENTRY_KIND,
        userId: user.id,
      },
      { expiresIn: 60 },
    );

    await supertest()
      .get(`/lti/embeddable-question/${course.id}`)
      .set('Cookie', [`auth_token=${loginEntryToken}`])
      .expect(401);
  });
});

describe('App and LTI session cookie coexistence', () => {
  const { supertest, getTestModule } = setupIntegrationTest(LtiModule);

  let jwtService: JwtService;
  beforeEach(() => {
    jwtService = getTestModule().get<JwtService>(JwtService);
  });

  const setupProfessorAndStudent = async () => {
    const professor = await UserFactory.create();
    const student = await UserFactory.create();
    const course = await CourseFactory.create();
    await UserCourseFactory.create({
      user: professor,
      course,
      role: Role.PROFESSOR,
    });
    await UserCourseFactory.create({
      user: student,
      course,
      role: Role.STUDENT,
    });
    return { professor, student, course };
  };

  const signLtiSession = (userId: number): string =>
    jwtService.sign({ kind: APP_AUTH_KIND, userId, restrictPaths });

  it('falls back to a fresh LTI session when the app cookie is a stale token from before the kind claim', async () => {
    const { professor, course } = await setupProfessorAndStudent();
    // Old pre-branch app cookie: correctly signed but expired and without `kind`
    const staleAppToken = jwtService.sign(
      { userId: professor.id },
      { expiresIn: -60 },
    );
    const ltiSession = signLtiSession(professor.id);

    // The stale cookie alone still grants nothing...
    await supertest()
      .get(`/lti/embeddable-question/${course.id}`)
      .set('Cookie', [`auth_token=${staleAppToken}`])
      .expect(401);

    // ...but it no longer shadows the fresh LTI session
    await supertest()
      .get(`/lti/embeddable-question/${course.id}`)
      .set('Cookie', [
        `auth_token=${staleAppToken}`,
        `lti_auth_token=${ltiSession}`,
      ])
      .expect(200);
  });

  it('still prefers a valid ordinary app session over the LTI session cookie', async () => {
    const { professor, student, course } = await setupProfessorAndStudent();
    const appSession = jwtService.sign({
      kind: APP_AUTH_KIND,
      userId: professor.id,
    });
    // An LTI session for a student could not list staff questions, so a 200
    // proves the ordinary app session took precedence.
    const studentLtiSession = signLtiSession(student.id);

    await supertest()
      .get(`/lti/embeddable-question/${course.id}`)
      .set('Cookie', [
        `auth_token=${appSession}`,
        `lti_auth_token=${studentLtiSession}`,
      ])
      .expect(200);
  });

  it('rejects a request with no valid session cookie', async () => {
    const { course } = await setupProfessorAndStudent();

    await supertest().get(`/lti/embeddable-question/${course.id}`).expect(401);
  });
});
