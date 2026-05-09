import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ChatbotServiceProvider } from '@koh/common';
import { CourseSettingsModel } from '../course/course_settings.entity';
import { CourseChatbotSettingsModel } from '../chatbot/chatbot-infrastructure-models/course-chatbot-settings.entity';
import { ChatbotProviderModel } from '../chatbot/chatbot-infrastructure-models/chatbot-provider.entity';
import { buildPromptMessages, type PromptMessage } from './lib/prompt-builder';
import { extractTextFromBuffer } from './lib/file-extractor';
import { parseEssay } from './lib/essay-parser';
import { validateFeedbackResponse } from './lib/feedback-validator';
import { feedbackJsonSchema } from './lib/feedback-json-schema';
import type { FeedbackResponse } from './types/feedback-response';

type ResolvedLlm = {
  provider: ChatbotProviderModel;
  modelName: string;
};

@Injectable()
export class EssayFeedbackService {
  private readonly logger = new Logger(EssayFeedbackService.name);

  async extractText(
    courseId: number,
    file: Express.Multer.File,
  ): Promise<{ essay_text: string; filename: string }> {
    await this.assertEssayEvaluationEnabled(courseId);
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
      throw new BadRequestException(message);
    }
  }

  async generateFeedback(
    courseId: number,
    essayText: string,
  ): Promise<FeedbackResponse> {
    await this.assertEssayEvaluationEnabled(courseId);
    const paragraphs = parseEssay(essayText);
    const messages = buildPromptMessages(paragraphs);

    let raw: unknown;
    try {
      raw = await this.invokeLlm(courseId, messages);
    } catch (firstErr) {
      this.logger.warn(
        `Essay feedback LLM first attempt failed: ${firstErr}`,
      );
      raw = await this.invokeLlm(courseId, messages);
    }

    try {
      return validateFeedbackResponse(raw, paragraphs);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Validation failed.';
      throw new BadRequestException(message);
    }
  }

  private async assertEssayEvaluationEnabled(courseId: number): Promise<void> {
    const settings = await CourseSettingsModel.findOne({
      where: { courseId },
    });
    if (!settings?.essayEvaluationEnabled) {
      throw new ForbiddenException(
        'Essay evaluation is not enabled for this course.',
      );
    }
  }

  /** Course chatbot model + provider; null if not configured. */
  private async tryResolveLlmFromCourse(
    courseId: number,
  ): Promise<ResolvedLlm | null> {
    const courseSettings = await CourseChatbotSettingsModel.findOne({
      where: { courseId },
      relations: {
        llmModel: {
          provider: true,
        },
      },
    });

    if (!courseSettings?.llmModel?.provider) {
      return null;
    }

    const modelName = courseSettings.llmModel.modelName?.trim();
    if (!modelName) {
      return null;
    }

    return {
      provider: courseSettings.llmModel.provider,
      modelName,
    };
  }

  private useLocalEnvOpenAi(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    const key = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_MODEL?.trim();
    return !!key && !!model;
  }

  private openAiProviderFromEnv(): ChatbotProviderModel {
    const apiKey = process.env.OPENAI_API_KEY!.trim();
    const baseUrl = process.env.OPENAI_BASE_URL?.trim();
    return {
      apiKey,
      baseUrl: baseUrl || undefined,
      headers: {},
      providerType: ChatbotServiceProvider.OpenAI,
    } as ChatbotProviderModel;
  }

  private async invokeLlm(
    courseId: number,
    messages: PromptMessage[],
  ): Promise<unknown> {
    const fromCourse = await this.tryResolveLlmFromCourse(courseId);

    if (fromCourse) {
      const { provider, modelName } = fromCourse;
      if (provider.providerType === ChatbotServiceProvider.OpenAI) {
        return this.callOpenAiStructured(provider, modelName, messages);
      }
      if (provider.providerType === ChatbotServiceProvider.Ollama) {
        return this.callOllamaJson(provider, modelName, messages);
      }
      throw new BadRequestException(
        'Essay feedback does not support this chatbot provider type.',
      );
    }

    if (this.useLocalEnvOpenAi()) {
      const modelName = process.env.OPENAI_MODEL!.trim();
      this.logger.log(
        `Essay feedback: no course chatbot model; using OPENAI_API_KEY / OPENAI_MODEL from environment (non-production only; courseId=${courseId}).`,
      );
      return this.callOpenAiStructured(
        this.openAiProviderFromEnv(),
        modelName,
        messages,
      );
    }

    throw new BadRequestException(
      'Course chatbot is not configured. Open Chatbot Settings for this course and select a model, or set OPENAI_API_KEY and OPENAI_MODEL in .env for local development.',
    );
  }

  private async callOpenAiStructured(
    provider: ChatbotProviderModel,
    modelName: string,
    messages: PromptMessage[],
  ): Promise<unknown> {
    if (!provider.apiKey) {
      throw new BadRequestException(
        'OpenAI API key is not configured for this organization chatbot provider.',
      );
    }

    const openai = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl?.trim() || undefined,
      defaultHeaders: this.providerHeaders(provider),
    });

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: messages as ChatCompletionMessageParam[],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'feedback',
          strict: true,
          schema: feedbackJsonSchema as unknown as Record<string, unknown>,
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new BadRequestException('The model returned an empty response.');
    }
    return JSON.parse(raw) as unknown;
  }

  private providerHeaders(
    provider: ChatbotProviderModel,
  ): Record<string, string> | undefined {
    const h = provider.headers as Record<string, unknown> | undefined;
    if (!h || typeof h !== 'object') {
      return undefined;
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(h)) {
      if (v !== undefined && v !== null && String(v).length > 0) {
        out[k] = String(v);
      }
    }
    return Object.keys(out).length ? out : undefined;
  }

  private async callOllamaJson(
    provider: ChatbotProviderModel,
    modelName: string,
    messages: PromptMessage[],
  ): Promise<unknown> {
    const base = (
      provider.baseUrl?.trim() || 'http://127.0.0.1:11434'
    ).replace(/\/$/, '');
    const url = `${base}/api/chat`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.providerHeaders(provider),
    };

    const body = {
      model: modelName,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      format: 'json',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(
        `Ollama request failed (${res.status}): ${text.slice(0, 500)}`,
      );
    }

    const data = (await res.json()) as {
      message?: { content?: string };
    };
    const content = data.message?.content;
    if (!content) {
      throw new BadRequestException('Ollama returned an empty response.');
    }

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new BadRequestException(
        'Ollama did not return valid JSON. Try an OpenAI-capable model with JSON schema support.',
      );
    }
  }
}
