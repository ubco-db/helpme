import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Param,
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
import { User } from '../decorators/user.decorator';
import { UserModel } from '../profile/user.entity';

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
  ): Promise<EssayFeedbackExtractTextResponse> {
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
    @Body() body: EssayFeedbackRequest,
    @User({ chat_token: true }) user: UserModel,
  ): Promise<EssayFeedbackResponse> {
    if (!user.chat_token) {
      throw new ForbiddenException('User does not have a chatbot token.');
    }
    return this.essayFeedbackService.generateFeedback(
      courseId,
      body.essay_text,
      user.chat_token.token,
    );
  }
}
