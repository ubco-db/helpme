import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CourseSettingsModel } from '../course/course_settings.entity';
<<<<<<< Updated upstream
import { extractTextFromBuffer } from './lib/file-extractor';
import { parseEssay } from './lib/essay-parser';
import { validateFeedbackResponse } from './lib/feedback-validator';
import type {
  EssayFeedbackExtractTextResponse,
  EssayFeedbackResponse,
} from '@koh/common';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
=======
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
import { buildPromptMessages, type PromptMessage } from './lib/prompt-builder';
import { extractTextFromBuffer } from './lib/file-extractor';
import { parseEssay } from './lib/essay-parser';
import { validateFeedbackResponse } from './lib/feedback-validator';
import type { FeedbackResponse } from './types/feedback-response';
>>>>>>> Stashed changes

@Injectable()
export class EssayFeedbackService {
  private readonly logger = new Logger(EssayFeedbackService.name);

<<<<<<< Updated upstream
  constructor(private readonly chatbotApiService: ChatbotApiService) {}
=======
  constructor(private readonly chatbotApi: ChatbotApiService) {}
>>>>>>> Stashed changes

  async extractText(
    courseId: number,
    file: Express.Multer.File,
<<<<<<< Updated upstream
  ): Promise<EssayFeedbackExtractTextResponse> {
    await this.assertEssayEvaluationEnabled(courseId);
=======
  ): Promise<{ assignment_text: string; filename: string }> {
    await this.assertAssignmentEvaluationEnabled(courseId);
>>>>>>> Stashed changes
    try {
      const assignment_text = await extractTextFromBuffer(
        file.buffer,
        file.mimetype || 'application/octet-stream',
        file.originalname,
      );
      return { assignment_text, filename: file.originalname };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to extract text.';
      throw new BadRequestException(message);
    }
  }

  async generateFeedback(
    courseId: number,
<<<<<<< Updated upstream
    essayText: string,
    userToken: string,
  ): Promise<EssayFeedbackResponse> {
    await this.assertEssayEvaluationEnabled(courseId);
    const paragraphs = parseEssay(essayText);
=======
    assignmentText: string,
  ): Promise<FeedbackResponse> {
    await this.assertAssignmentEvaluationEnabled(courseId);
    const paragraphs = parseEssay(assignmentText);
    const messages = buildPromptMessages(paragraphs);
>>>>>>> Stashed changes

    let raw: unknown;
    try {
      raw = await this.chatbotApiService.generateEssayFeedback(
        courseId,
        essayText,
        paragraphs,
        userToken,
      );
    } catch (firstErr) {
      this.logger.warn(
<<<<<<< Updated upstream
        `Essay feedback chatbot request first attempt failed: ${firstErr}`,
      );
      raw = await this.chatbotApiService.generateEssayFeedback(
        courseId,
        essayText,
        paragraphs,
        userToken,
=======
        `Assignment feedback LLM first attempt failed: ${firstErr}`,
>>>>>>> Stashed changes
      );
    }

    try {
      return validateFeedbackResponse(raw, paragraphs);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Validation failed.';
      throw new BadRequestException(message);
    }
  }

  private async assertAssignmentEvaluationEnabled(
    courseId: number,
  ): Promise<void> {
    const settings = await CourseSettingsModel.findOne({
      where: { courseId },
    });
    if (!settings?.assignmentEvaluationEnabled) {
      throw new ForbiddenException(
        'Assignment evaluation is not enabled for this course.',
      );
    }
  }
<<<<<<< Updated upstream
=======

  /**
   * Sends the prompt to the chatbot service's `/chatbot/query` endpoint with
   * the course's `courseId` so the chatbot routes the request through the
   * course's configured generatorLLM. The `default` query type's template is
   * just `{query}` (see chatbot repo), so we flatten the system + user
   * messages into a single string and append a strict JSON-only instruction.
   * The chatbot's `/query` route does NOT enforce JSON schema, so this
   * method also runs a tolerant client-side parse and retries once with a
   * stronger instruction if the first answer isn't valid JSON.
   */
  private async invokeLlm(
    courseId: number,
    messages: PromptMessage[],
  ): Promise<unknown> {
    const flattened = this.flattenMessages(messages);

    let raw: string;
    try {
      raw = await this.chatbotApi.queryChatbotForCourse(
        flattened,
        courseId,
        'default',
      );
    } catch (firstErr) {
      this.logger.warn(`chatbot /query failed once: ${String(firstErr)}`);
      raw = await this.chatbotApi.queryChatbotForCourse(
        flattened,
        courseId,
        'default',
      );
    }

    try {
      return this.parseJsonLoose(raw);
    } catch (parseErr) {
      this.logger.warn(
        `chatbot returned non-JSON, retrying with stricter instruction: ${String(
          parseErr,
        )}`,
      );
      const stricter =
        flattened +
        '\n\nIMPORTANT: your previous reply was not valid JSON. ' +
        'Output ONLY a single valid JSON object now. ' +
        'Start the response with `{` and end with `}`. ' +
        'Do NOT include markdown code fences or any prose.';
      const retry = await this.chatbotApi.queryChatbotForCourse(
        stricter,
        courseId,
        'default',
      );
      return this.parseJsonLoose(retry);
    }
  }

  private flattenMessages(messages: PromptMessage[]): string {
    const body = messages
      .map((m) =>
        m.role === 'system'
          ? `[SYSTEM]\n${m.content}`
          : `[USER]\n${m.content}`,
      )
      .join('\n\n');
    return (
      body +
      '\n\n[FORMAT]\n' +
      'Return ONLY a single JSON object that matches the feedback schema. ' +
      'Do not include code fences, markdown, or any prose before or after the JSON.'
    );
  }

  /**
   * Parses chatbot answer text into JSON, tolerating common LLM quirks like
   * leading/trailing prose, ```json fenced``` blocks, or `<think>` reasoning
   * traces. Throws BadRequestException if nothing parseable is found.
   */
  private parseJsonLoose(text: string): unknown {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new BadRequestException('Chatbot returned an empty response.');
    }

    let cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const slice = cleaned.slice(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(slice);
        } catch {
          /* fall through */
        }
      }
      throw new BadRequestException('Chatbot returned non-JSON content.');
    }
  }
>>>>>>> Stashed changes
}
