import { MailTestingModule } from 'mail/mail.module';
import { setupIntegrationTest } from './util/testUtils';
import {
  mailServiceFactory,
  UserFactory,
  userSubscriptionFactory,
} from './util/factories';
import {
  TokenAction,
  TokenType,
  UserTokenModel,
} from 'profile/user-token.entity';

describe('Mail Integration', () => {
  const supertest = setupIntegrationTest(MailTestingModule);

  describe('POST registration/resend', () => {
    it('returns UNAUTHORIZED if not logged in', async () => {
      await supertest().post('/mail/registration/resend').expect(401);
    });

    it('returns BAD REQUEST if no pending verification code found', async () => {
      const user = await UserFactory.create();
      await supertest({ userId: user.id })
        .post('/mail/registration/resend')
        .expect(400);
    });

    it('returns ACCEPTED if verification code resent', async () => {
      const user = await UserFactory.create();
      await UserTokenModel.create({
        user,
        token: 'token',
        token_type: TokenType.EMAIL_VERIFICATION,
        token_action: TokenAction.ACTION_PENDING,
        created_at: parseInt(new Date().getTime().toString()),
        expires_at: parseInt(new Date().getTime().toString()) + 1000 * 60 * 15,
      }).save();

      await supertest({ userId: user.id })
        .post('/mail/registration/resend')
        .expect(202);
    });
  });

  describe('Find all mail services for a user', () => {
    it('returns UNAUTHORIZED if not logged in', async () => {
      await supertest().get('/mail-services/').expect(401);
    });

    it('returns all mail services for a user', async () => {
      const user = await UserFactory.create();
      // create a mail service
      const studentMailService = await mailServiceFactory.create();
      await userSubscriptionFactory.create({
        isSubscribed: true,
        user: user,
        service: studentMailService,
      });

      const resp = await supertest({ userId: user.id }).get('/mail-services/');
      expect(resp.status).toBe(200);
    });
  });
});
