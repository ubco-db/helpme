import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CourseSettingsModel } from '../course/course_settings.entity';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
import {
  buildReformatPromptMessages,
  buildFeedbackPromptMessages,
  type PromptMessage,
} from './lib/prompt-builder';
import { extractTextFromBuffer } from './lib/file-extractor';
import { parseEssay } from './lib/essay-parser';
import { validateFeedbackResponse } from './lib/feedback-validator';
import { validateReformatResponse } from './lib/reformat-validator';
import type {
  EssayFeedbackExtractTextResponse,
  EssayFeedbackParagraph,
  EssayFeedbackResponse,
} from '@koh/common';

@Injectable()
export class EssayFeedbackService {
  private readonly logger = new Logger(EssayFeedbackService.name);

  constructor(private readonly chatbotApiService: ChatbotApiService) {}

  async extractText(
    courseId: number,
    file: Express.Multer.File,
  ): Promise<EssayFeedbackExtractTextResponse> {
    await this.assertAssignmentEvaluationEnabled(courseId);
    try {
      const essay_text = await extractTextFromBuffer(
        file.buffer,
        file.mimetype || 'application/octet-stream',
        file.originalname,
      );
      return { essay_text, filename: file.originalname };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to extract text.';
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Two-pass LLM pipeline:
   *
   * Pass 1 (Reformat): Send raw text to LLM → get back structured paragraphs.
   *   Falls back to naive parseEssay() if the LLM response is invalid.
   *
   * Pass 2 (Feedback): Send structured paragraphs to LLM → get back
   *   annotated feedback response.
   */
  async generateFeedback(
    courseId: number,
    essayText: string,
  ): Promise<EssayFeedbackResponse> {
    await this.assertAssignmentEvaluationEnabled(courseId);

    // --- Pass 1: Paragraph Reformatting ---
    const paragraphs = await this.reformatParagraphs(courseId, essayText);

    // --- Pass 2: Feedback Generation ---
    const feedbackMessages = buildFeedbackPromptMessages(paragraphs);

    let raw: unknown;
    try {
      raw = await this.invokeLlm(courseId, feedbackMessages);
    } catch (firstErr) {
      this.logger.warn(
        `Assignment feedback LLM first attempt failed: ${firstErr}`,
      );
      raw = await this.invokeLlm(courseId, feedbackMessages);
    }

    try {
      return validateFeedbackResponse(raw, paragraphs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed.';
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Pass 1: Asks the LLM to split raw text into logical paragraphs.
   * Falls back to naive blank-line splitting if the LLM call fails.
   */
  private async reformatParagraphs(
    courseId: number,
    essayText: string,
  ): Promise<EssayFeedbackParagraph[]> {
    const reformatMessages = buildReformatPromptMessages(essayText);
    try {
      const raw = await this.invokeLlm(courseId, reformatMessages);
      return validateReformatResponse(raw, essayText);
    } catch (err) {
      this.logger.warn(
        `Reformat LLM call failed, falling back to parseEssay(): ${err}`,
      );
      return parseEssay(essayText);
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
      raw = await this.chatbotApiService.queryChatbotForCourse(
        flattened,
        courseId,
        'default',
      );
    } catch (firstErr) {
      this.logger.warn(`chatbot /query failed once: ${String(firstErr)}`);
      raw = await this.chatbotApiService.queryChatbotForCourse(
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
      const retry = await this.chatbotApiService.queryChatbotForCourse(
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
        m.role === 'system' ? `[SYSTEM]\n${m.content}` : `[USER]\n${m.content}`,
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
   * traces. Throws InternalServerErrorException if nothing parseable is found.
   */
  private parseJsonLoose(text: string): unknown {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new InternalServerErrorException(
        'Chatbot returned an empty response.',
      );
    }

    const cleaned = text
      .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '')
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const firstBracket = cleaned.indexOf('[');
      const lastBrace = cleaned.lastIndexOf('}');
      const lastBracket = cleaned.lastIndexOf(']');

      // Try object parse first
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const slice = cleaned.slice(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(slice);
        } catch {
          /* fall through */
        }
      }

      // Try array parse (for reformat responses)
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        const slice = cleaned.slice(firstBracket, lastBracket + 1);
        try {
          return JSON.parse(slice);
        } catch {
          /* fall through */
        }
      }

      throw new InternalServerErrorException(
        'Chatbot returned non-JSON content.',
      );
    }
  }
}
