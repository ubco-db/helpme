import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotApiService } from './chatbot-api.service';
import { MailService } from 'mail/mail.service';
import { ChatbotQuestionModel } from './question.entity';
import { BadRequestException } from '@nestjs/common';
import { NotifyUpdatedChatbotAnswerParams, Role } from '@koh/common';

describe('ChatbotController - notifyUpdatedAnswer', () => {
  let controller: ChatbotController;
  let mailService: { sendEmail: jest.Mock };

  const mockChatbotService = {};
  const mockChatbotApiService = {};

  beforeAll(async () => {
    mailService = {
      sendEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatbotController],
      providers: [
        { provide: ChatbotService, useValue: mockChatbotService },
        { provide: ChatbotApiService, useValue: mockChatbotApiService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    controller = module.get<ChatbotController>(ChatbotController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mailService.sendEmail.mockReset();
  });

  const makeUser = (courseId: number, role: Role): any => ({
    id: 1,
    courses: [{ courseId, role }],
  });

  const makeBody = (
    overrides: Partial<NotifyUpdatedChatbotAnswerParams> = {},
  ): NotifyUpdatedChatbotAnswerParams => ({
    oldAnswer: 'old',
    newAnswer: 'new',
    ...overrides,
  });

  it('throws BadRequestException when answer did not change', async () => {
    const body = makeBody({ oldAnswer: 'same', newAnswer: ' same ' });

    await expect(
      controller.notifyUpdatedAnswer(
        1,
        'vec-id',
        body,
        makeUser(1, Role.PROFESSOR),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException when there are no recipients', async () => {
    jest.spyOn(ChatbotQuestionModel, 'find').mockResolvedValue([] as any);

    const body = makeBody();

    await expect(
      controller.notifyUpdatedAnswer(
        1,
        'vec-id',
        body,
        makeUser(1, Role.PROFESSOR),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ChatbotQuestionModel.find).toHaveBeenCalledTimes(1);
    expect(mailService.sendEmail).not.toHaveBeenCalled();
  });

  it('sends individual emails and caps at 5 recipients', async () => {
    const courseId = 1;
    const vectorStoreId = 'vec-id';
    const emails = [
      'u1@example.com',
      'u2@example.com',
      'u3@example.com',
      'u4@example.com',
      'u5@example.com',
      'u6@example.com',
    ];

    jest.spyOn(ChatbotQuestionModel, 'find').mockResolvedValue(
      emails.map((email) => ({
        interaction: {
          course: { id: courseId, name: 'Test Course' },
          user: { email },
        },
      })) as any,
    );

    const body = makeBody();

    const result = await controller.notifyUpdatedAnswer(
      courseId,
      vectorStoreId,
      body,
      makeUser(courseId, Role.PROFESSOR),
    );

    // Should only send to first 5 emails
    expect(mailService.sendEmail).toHaveBeenCalledTimes(5);
    const calledRecipients = mailService.sendEmail.mock.calls.map(
      (args) => args[0].receiverOrReceivers,
    );
    expect(calledRecipients).toEqual(emails.slice(0, 5));

    expect(result).toEqual({ recipients: 5 });
  });
});
