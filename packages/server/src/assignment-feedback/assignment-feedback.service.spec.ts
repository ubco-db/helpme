import { ForbiddenException } from '@nestjs/common';
import { AssignmentFeedbackService } from './assignment-feedback.service';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
import { CourseSettingsModel } from '../course/course_settings.entity';

/**
 * Unit tests for the two-pass Assignment AI feedback pipeline.
 *
 * Pass 1 (reformat): LLM splits raw text into paragraphs (JSON array)
 * Pass 2 (feedback): LLM generates feedback annotations (JSON object)
 *
 * These verify:
 *   - Both passes delegate to chatbot `/query` via queryChatbotForCourse
 *   - Pass 1 failure gracefully falls back to parseEssay()
 *   - Flattened prompts contain [SYSTEM]/[USER]/[FORMAT] markers
 *   - Answer strings are parsed leniently (code fences, arrays, objects)
 *   - The route still respects course-level `assignmentEvaluationEnabled`
 */
describe('AssignmentFeedbackService two-pass pipeline', () => {
  /** A valid Pass 1 (reformat) response. */
  const buildValidReformatAnswer = (): string =>
    JSON.stringify([{ id: 'p1', text: 'First paragraph.' }]);

  /** A valid Pass 2 (feedback) response. */
  const buildValidFeedbackAnswer = (): string =>
    JSON.stringify({
      annotations: [
        {
          id: 1,
          paragraph_id: 'p1',
          function: 'content',
          level: 'text',
          issue_type: 'Thesis clarity',
          severity: 'medium',
          evidence: { exact_quote: 'First' },
          feedback: 'feedback text',
          revision_guidance: 'do this',
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
  let service: AssignmentFeedbackService;
  let findOneSpy: jest.SpyInstance;

  beforeEach(() => {
    queryChatbotForCourse = jest.fn();
    const chatbotApi = {
      queryChatbotForCourse,
    } as unknown as ChatbotApiService;
    service = new AssignmentFeedbackService(chatbotApi);

    findOneSpy = jest
      .spyOn(CourseSettingsModel, 'findOne')
      .mockResolvedValue({ assignmentEvaluationEnabled: true } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('makes two LLM calls: reformat (Pass 1) then feedback (Pass 2)', async () => {
    queryChatbotForCourse
      .mockResolvedValueOnce(buildValidReformatAnswer())
      .mockResolvedValueOnce(buildValidFeedbackAnswer());

    const result = await service.generateFeedback(42, 'First paragraph.');

    expect(queryChatbotForCourse).toHaveBeenCalledTimes(2);

    // Pass 1: reformat call
    const [reformatPrompt, reformatCourseId] =
      queryChatbotForCourse.mock.calls[0];
    expect(reformatCourseId).toBe(42);
    expect(reformatPrompt).toContain('[SYSTEM]');
    expect(reformatPrompt).toContain('First paragraph.');

    // Pass 2: feedback call
    const [feedbackPrompt, feedbackCourseId] =
      queryChatbotForCourse.mock.calls[1];
    expect(feedbackCourseId).toBe(42);
    expect(feedbackPrompt).toContain('[SYSTEM]');
    expect(feedbackPrompt).toContain('Paragraph p1');

    expect(result.essay.paragraphs).toEqual([
      { id: 'p1', text: 'First paragraph.' },
    ]);
    expect(result.annotations).toHaveLength(1);
    expect(result.overall_feedback.summary).toBe('summary');
  });

  it('falls back to parseEssay() when Pass 1 (reformat) fails', async () => {
    queryChatbotForCourse
      .mockRejectedValueOnce(new Error('reformat LLM down')) // Pass 1 fails
      .mockResolvedValueOnce(buildValidFeedbackAnswer()); // Pass 2 succeeds

    const result = await service.generateFeedback(7, 'First paragraph.');

    // Pass 1 failed + Pass 2 succeeded = 2 calls total
    expect(queryChatbotForCourse).toHaveBeenCalledTimes(2);
    expect(result.annotations).toHaveLength(1);
    // Paragraphs came from parseEssay() fallback
    expect(result.essay.paragraphs[0].id).toBe('p1');
  });

  it('tolerates chatbot answers wrapped in ```json fences', async () => {
    const wrappedReformat = '```json\n' + buildValidReformatAnswer() + '\n```';
    queryChatbotForCourse
      .mockResolvedValueOnce(wrappedReformat)
      .mockResolvedValueOnce(buildValidFeedbackAnswer());

    const result = await service.generateFeedback(7, 'First paragraph.');
    expect(result.annotations).toHaveLength(1);
  });

  it('refuses to call chatbot when assignmentEvaluationEnabled=false', async () => {
    findOneSpy.mockResolvedValueOnce({
      assignmentEvaluationEnabled: false,
    } as any);

    await expect(
      service.generateFeedback(1, 'First paragraph.'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(queryChatbotForCourse).not.toHaveBeenCalled();
  });
});
