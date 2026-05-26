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
  AssignmentFeedbackExtractTextResponse,
  AssignmentFeedbackRequest,
  AssignmentFeedbackResponse,
  Role,
} from '@koh/common';
import { Roles } from '../decorators/roles.decorator';
import { CourseRolesGuard } from '../guards/course-roles.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { AssignmentFeedbackService } from './assignment-feedback.service';
import { memoryStorage } from 'multer';

/* A series of endpoints used for the "AI Assignment Feedback" feature (used specifically by LLED courses for now) */
@Controller('ai-assignment-feedback')
export class AssignmentFeedbackController {
  constructor(
    private readonly assignmentFeedbackService: AssignmentFeedbackService,
  ) {}

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
  ): Promise<AssignmentFeedbackExtractTextResponse> {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded.');
    }
    return this.assignmentFeedbackService.extractText(courseId, file);
  }

  @Post(':courseId/generate-feedback')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async generateFeedback(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: AssignmentFeedbackRequest,
  ): Promise<AssignmentFeedbackResponse> {
    return this.assignmentFeedbackService.generateFeedback(
      courseId,
      body.essay_text,
    );
  }
}
