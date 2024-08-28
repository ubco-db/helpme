import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';
import { MailServiceModel } from './mail-services.entity';
import { UserModel } from 'profile/user.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Role, OrganizationRole, MailServiceType } from '@koh/common';

describe('MailService', () => {
  let service: MailService;
  let mailerService: MailerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
        subject: 'Pasword Reset Request',
        text: expect.stringContaining(url),
      });
    });
  });

  describe('sendEmail', () => {
    it('should send an email based on emailPost params', async () => {
      const emailPost = {
        type: 'async_question_human_answered' as MailServiceType,
        receiver: 'example@example.com',
        subject: 'Welcome!',
        content: 'Thank you for joining us.',
      };

      jest.spyOn(MailServiceModel, 'findOne').mockResolvedValue({
        content: 'Default Content',
      } as MailServiceModel);

      await service.sendEmail(emailPost);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: emailPost.receiver,
        from: '"HelpMe Support"',
        subject: emailPost.subject,
        html: expect.stringContaining(emailPost.content),
      });
    });

    it('should throw an error if mail type is not found', async () => {
      jest.spyOn(MailServiceModel, 'findOne').mockResolvedValue(null);

      await expect(
        service.sendEmail({ type: 'INVALID_TYPE' } as any),
      ).rejects.toThrow(HttpException);
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