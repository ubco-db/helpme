import { ForbiddenException } from '@nestjs/common';
import { EssayFeedbackService } from './essay-feedback.service';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
import { CourseSettingsModel } from '../course/course_settings.entity';

/**
 * Unit tests for the Assignment AI feedback -> chatbot service integration.
 *
 * These verify the contract documented in the plan:
 *   - EssayFeedbackService.generateFeedback delegates to chatbot
 *     `POST /chat/chatbot/query` via ChatbotApiService.queryChatbotForCourse
 *   - the request carries the courseId and type='default'
 *   - the flattened prompt contains the [SYSTEM]/[USER] markers and
 *     a strict JSON-only [FORMAT] instruction
 *   - the answer string is parsed leniently (code fences tolerated)
 *   - if the answer isn't JSON, a single retry is issued with a stricter prompt
 *   - if the chatbot call throws, a single retry is issued
 *   - the route still respects course-level `assignmentEvaluationEnabled`
 *
 * No real HTTP, DB, or Nest module is required - ChatbotApiService is a
 * plain mock and CourseSettingsModel.findOne is stubbed.
 */
describe('EssayFeedbackService chatbot /query integration', () => {
  const buildValidAnswer = (): string =>
    JSON.stringify({
      submission_id: null,
      created_at: null,
      essay: { paragraphs: [{ id: 'p1', text: 'First paragraph.' }] },
      annotations: [
        {
          id: 1,
          paragraph_id: 'p1',
          char_start: 0,
          char_end: 5,
          function: 'content',
          level: 'text',
          issue_type: 'Thesis clarity',
          severity: 'medium',
          evidence: { quote: 'First', reason: 'unclear thesis' },
          feedback: 'feedback text',
          revision_guidance: 'do this',
          citations: [],
        },
      ],
      overall_feedback: {
        summary: 'summary',
        priority_issues: ['issue'],
        next_steps: ['step'],
        reflection_questions: ['q1', 'q2'],
      },
    });

  let queryChatbotForCourse: jest.Mock;
  let service: EssayFeedbackService;
  let findOneSpy: jest.SpyInstance;

  beforeEach(() => {
    queryChatbotForCourse = jest.fn();
    const chatbotApi = {
      queryChatbotForCourse,
    } as unknown as ChatbotApiService;
    service = new EssayFeedbackService(chatbotApi);

    findOneSpy = jest
      .spyOn(CourseSettingsModel, 'findOne')
      .mockResolvedValue({ assignmentEvaluationEnabled: true } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls chatbot /query with the courseId, type=default, and a flattened system+user prompt', async () => {
    queryChatbotForCourse.mockResolvedValueOnce(buildValidAnswer());

    const result = await service.generateFeedback(42, 'First paragraph.');

    expect(queryChatbotForCourse).toHaveBeenCalledTimes(1);
    const [prompt, courseId, type] = queryChatbotForCourse.mock.calls[0];
    expect(courseId).toBe(42);
    expect(type).toBe('default');
    expect(prompt).toContain('[SYSTEM]');
    expect(prompt).toContain('[USER]');
    expect(prompt).toContain('[FORMAT]');
    expect(prompt).toContain('Return ONLY a single JSON object');
    expect(prompt).toContain('First paragraph.');

    expect(result.essay.paragraphs).toEqual([
      { id: 'p1', text: 'First paragraph.' },
    ]);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].paragraph_id).toBe('p1');
    expect(result.overall_feedback.summary).toBe('summary');
  });

  it('tolerates chatbot answers wrapped in ```json fences', async () => {
    const wrapped = '```json\n' + buildValidAnswer() + '\n```';
    queryChatbotForCourse.mockResolvedValueOnce(wrapped);

    const result = await service.generateFeedback(7, 'First paragraph.');
    expect(result.annotations).toHaveLength(1);
  });

  it('strips <think> blocks and surrounding prose before parsing', async () => {
    const noisy =
      '<think>let me reason about this carefully</think>\n' +
      'Sure, here is the feedback you asked for:\n\n' +
      buildValidAnswer() +
      '\n\nThanks!';
    queryChatbotForCourse.mockResolvedValueOnce(noisy);

    const result = await service.generateFeedback(3, 'First paragraph.');
    expect(result.annotations).toHaveLength(1);
  });

  it('retries once with a stricter instruction when the first answer is not parseable JSON', async () => {
    queryChatbotForCourse
      .mockResolvedValueOnce('Sorry, here is some prose without any JSON object.')
      .mockResolvedValueOnce(buildValidAnswer());

    const result = await service.generateFeedback(99, 'First paragraph.');

    expect(queryChatbotForCourse).toHaveBeenCalledTimes(2);
    const secondPrompt = queryChatbotForCourse.mock.calls[1][0] as string;
    expect(secondPrompt).toContain('previous reply was not valid JSON');
    expect(secondPrompt).toContain('Start the response with `{`');
    expect(result.annotations).toHaveLength(1);
  });

  it('retries once when the chatbot call itself throws (transient failure)', async () => {
    queryChatbotForCourse
      .mockRejectedValueOnce(new Error('chatbot service down'))
      .mockResolvedValueOnce(buildValidAnswer());

    const result = await service.generateFeedback(11, 'First paragraph.');
    expect(queryChatbotForCourse).toHaveBeenCalledTimes(2);
    expect(result.annotations).toHaveLength(1);
  });

  it('refuses to call chatbot when the course has assignmentEvaluationEnabled=false', async () => {
    findOneSpy.mockResolvedValueOnce({
      assignmentEvaluationEnabled: false,
    } as any);

    await expect(
      service.generateFeedback(1, 'First paragraph.'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(queryChatbotForCourse).not.toHaveBeenCalled();
  });
});
