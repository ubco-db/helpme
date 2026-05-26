import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  EssayFeedbackExtractTextResponse,
  EssayFeedbackRequest,
  EssayFeedbackResponse,
  Role,
} from '@koh/common';
import { Roles } from '../decorators/roles.decorator';
import { CourseRolesGuard } from '../guards/course-roles.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { EssayFeedbackService } from './essay-feedback.service';
import { memoryStorage } from 'multer';

/* A series of endpoints used for the "AI Essay/Assignment Feedback" feature (used specifically be LLED courses for now) */
@Controller('ai-assignment-feedback')
export class EssayFeedbackController {
  constructor(private readonly essayFeedbackService: EssayFeedbackService) {}

  @Post(':courseId/extract-text')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async extractText(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          // Note that nestjs filetypevalidator comes with mime type and magic number validation build in
          fileType: 'txt|md|doc|docx|pdf',
        })
        .addMaxSizeValidator({
          maxSize: 10 * 1024 * 1024, // 10MB limit per file
        })
        .build(),
    )
    file: Express.Multer.File,
  ): Promise<EssayFeedbackExtractTextResponse> {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded.');
    }
    return this.essayFeedbackService.extractText(courseId, file);
  }

  @Post(':courseId/generate-feedback')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async generateFeedback(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: EssayFeedbackRequest,
  ): Promise<EssayFeedbackResponse> {
    return this.essayFeedbackService.generateFeedback(
      courseId,
      body.essay_text,
    );
  }
}
