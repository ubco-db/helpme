import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@koh/common';
import { Roles } from '../decorators/roles.decorator';
import { CourseRolesGuard } from '../guards/course-roles.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { EssayFeedbackService } from './essay-feedback.service';
import { EssayFeedbackRequestDto } from './dto/essay-feedback-request.dto';

const TEN_MB = 10 * 1024 * 1024;

@Controller('courses')
export class EssayFeedbackController {
  constructor(private readonly essayFeedbackService: EssayFeedbackService) {}

  @Post(':courseId/essay-feedback/extract-text')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: TEN_MB },
    }),
  )
  async extractText(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ essay_text: string; filename: string }> {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded.');
    }
    return this.essayFeedbackService.extractText(courseId, file);
  }

  @Post(':courseId/essay-feedback')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async generateFeedback(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: EssayFeedbackRequestDto,
  ) {
    return this.essayFeedbackService.generateFeedback(courseId, body.essay_text);
  }
}
