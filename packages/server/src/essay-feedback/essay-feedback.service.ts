import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CourseSettingsModel } from '../course/course_settings.entity';
import { extractTextFromBuffer } from './lib/file-extractor';
import { parseEssay } from './lib/essay-parser';
import { validateFeedbackResponse } from './lib/feedback-validator';
import type {
  EssayFeedbackExtractTextResponse,
  EssayFeedbackResponse,
} from '@koh/common';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';

@Injectable()
export class EssayFeedbackService {
  private readonly logger = new Logger(EssayFeedbackService.name);

  constructor(private readonly chatbotApiService: ChatbotApiService) {}

  async extractText(
    courseId: number,
    file: Express.Multer.File,
  ): Promise<EssayFeedbackExtractTextResponse> {
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
    userToken: string,
  ): Promise<EssayFeedbackResponse> {
    await this.assertEssayEvaluationEnabled(courseId);
    const paragraphs = parseEssay(essayText);

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
        `Essay feedback chatbot request first attempt failed: ${firstErr}`,
      );
      raw = await this.chatbotApiService.generateEssayFeedback(
        courseId,
        essayText,
        paragraphs,
        userToken,
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
}
