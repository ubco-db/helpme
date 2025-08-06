import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';
import { MailServiceModel } from './mail-services.entity';
import { UserModel } from 'profile/user.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import * as Common from '@koh/common';
import { MailServiceType, OrganizationRole, Role } from '@koh/common';
import {
  initFactoriesFromService,
  mailServiceFactory,
  SentEmailFactory,
} from '../../test/util/factories';
import { SentEmailModel } from './sent-email.entity';
import { FactoryService } from 'factory/factory.service';
import { FactoryModule } from '../factory/factory.module';
import { TestTypeOrmModule } from '../../test/util/testUtils';
import { DataSource } from 'typeorm';

describe('MailService', () => {
  let module: TestingModule;
  let service: MailService;
  let mailerService: MailerService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [TestTypeOrmModule, FactoryModule],
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get<MailerService>(MailerService);
    // mock isProd to true so that it actually calls mailerService's sendMail (instead of writing to file)
    // this is fine since sendMail is mocked above. BE CAREFUL modifying these tests so you don't accidentally send emails
    jest.spyOn(Common, 'isProd').mockReturnValue(true);

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterEach(async () => {
    const dataSource = module.get<DataSource>(DataSource);
    await dataSource.synchronize(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendUserVerificationCode', () => {
    it('should send a verification code email', async () => {
      const code = '123456';
      const receiver = 'test@example.com';

      await service.sendUserVerificationCode(code, receiver);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: receiver,
        from: '"HelpMe" <no-reply@coursehelp.ubc.ca>',
        subject: 'Verify your email address',
        text: `Your one time verification code is: ${code}`,
      });
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email', async () => {
      const receiver = 'test@example.com';
      const url = 'http://example.com/reset';

      await service.sendPasswordResetEmail(receiver, url);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: receiver,
        from: '"HelpMe" <no-reply@coursehelp.ubc.ca>',
        subject: 'Password Reset Request',
        text: expect.stringContaining(url),
      });
    });
  });

  describe('sendEmail', () => {
    it.each([
      'example@example.com',
      ['example1@example.com', 'example2@example.com'],
    ])(
      'should send an email based on emailPost params',
      async (receiverOrReceivers: string | string[]) => {
        const emailPost = {
          type: 'async_question_human_answered' as MailServiceType,
          receiverOrReceivers,
          subject: 'Welcome!',
          content: 'Thank you for joining us.',
        };

        await service.sendEmail(emailPost);

        expect(mailerService.sendMail).toHaveBeenCalledWith({
          to: receiverOrReceivers,
          from: '"HelpMe Support"',
          subject: emailPost.subject,
          html: expect.stringContaining(emailPost.content),
        });
      },
    );
  });

  describe('replyToSentEmail', () => {
    it('should send a reply email based on previously sent email', async () => {
      const mailService = await mailServiceFactory.create({
        serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
      });
      const previousEmail = await SentEmailFactory.create({
        accepted: ['example1@example.com', 'example2@example.com'],
        subject: 'subject',
        mailService,
      });
      await service.replyToSentEmail(previousEmail, 'reply');

      expect(
        await SentEmailModel.findOne({
          where: { emailId: previousEmail.emailId },
        }),
      ).toBeFalsy();
      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: previousEmail.accepted,
        from: '"HelpMe Support"',
        subject: 'Re: subject',
        html: expect.stringContaining('reply'),
        inReplyTo: previousEmail.emailId,
        references: previousEmail.emailId,
      });
    });
  });

  describe('findAllSubscriptions', () => {
    it('should return all subscriptions for a professor', async () => {
      const user = { id: 1 } as UserModel;

      jest
        .spyOn(UserCourseModel, 'findOne')
        .mockResolvedValue({ role: Role.PROFESSOR } as UserCourseModel);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            mailType: OrganizationRole.MEMBER,
            subscriptions: [{ isSubscribed: true }],
          },
          { id: 2, mailType: OrganizationRole.ADMIN, subscriptions: [] },
        ]),
      };
      jest
        .spyOn(MailServiceModel, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAllSubscriptions(user);

      expect(result).toHaveLength(2);
      expect(result[0].isSubscribed).toBe(true);
      expect(result[1].isSubscribed).toBe(false);
    });
  });
});
