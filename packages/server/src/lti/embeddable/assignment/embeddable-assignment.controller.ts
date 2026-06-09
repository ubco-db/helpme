import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard'
import { CourseRolesGuard } from '../../../guards/course-roles.guard'
import { Roles } from '../../../decorators/roles.decorator'
import { Response } from 'express'
import {
  EmbeddableQuestionFeedbackParams,
  EmbeddableQuestionFeedbackResponse,
  ExportEmbeddableAssignmentResultsParams,
  Role,
  UpdateEmbeddableFeedbackParams,
  UpsertEmbeddableAssignmentParams,
} from '@koh/common'
import { EmbeddableAssignmentService } from './embeddable-assignment.service'
import { UserId } from '../../../decorators/user.decorator'
import { EmbeddableAssignmentFeedbackModel } from './embeddable-assignment-feedback.entity'
import { EmbeddableAssignmentModel } from './embeddable-assignment.entity'

@Controller('lti/embeddable-assignment')
@UseInterceptors(ClassSerializerInterceptor)
export class EmbeddableAssignmentController {
  constructor(
    private embeddableAssignmentService: EmbeddableAssignmentService,
  ) {}

  /**
   * Lists all embeddable questions for a course, accessible to professor/TA role only
   * @param courseId
   */
  @Get(':courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async findAll(@Param('courseId', ParseIntPipe) courseId: number): Promise<EmbeddableAssignmentModel[]> {
    return await this.embeddableAssignmentService.findAllForCourse(courseId, {
      questions: {
        question: true,
      },
    });
  }

  /**
   * Retrieves a single assignment from a course. Accessible to all course roles.
   * @param courseId
   * @param assignmentId
   */
  @Get(':courseId/:assignmentId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async findOne(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ): Promise<EmbeddableAssignmentModel> {
    return await this.embeddableAssignmentService.findOne(assignmentId, {
      questions: {
        question: true,
      },
    });
  }

  /**
   * Calls upon chatbot service to generate feedback for a student's response to a given embeddable question within an assignment.
   * @param courseId
   * @param assignmentId
   * @param questionId
   * @param body Contains the student response.
   * @param userId User who is prompting for feedback
   */
  @Post(':courseId/:assignmentId/:questionId/feedback')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getFeedback(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: EmbeddableQuestionFeedbackParams,
    @UserId() userId: number,
  ): Promise<EmbeddableQuestionFeedbackResponse> {
    const responseText = body.responseText?.trim();
    if (!responseText) {
      throw new BadRequestException('Input is required');
    }

    const feedback = await this.embeddableAssignmentService.getFeedback(
      responseText,
      assignmentId,
      questionId,
      courseId,
      userId
    );

    return {
      feedback: feedback.aiFeedback,
      grade: feedback.aiGrade,
    }
  }

  /**
   * For creating a new embeddable question. Accessible to TA and Professor roles only.
   * @param courseId
   * @param body Parameters for creating the embeddable question.
   */
  @Post(':courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async create(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: UpsertEmbeddableAssignmentParams,
  ): Promise<EmbeddableAssignmentModel> {
    return await this.embeddableAssignmentService.upsert(
      courseId,
      body,
    );
  }

  /**
   * For updating an new embeddable question. Accessible to TA and Professor roles only.
   * @param courseId
   * @param assignmentId
   * @param body Parameters for updating the embeddable question.
   */
  @Patch(':courseId/:assignmentId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async update(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() body: UpsertEmbeddableAssignmentParams,
  ): Promise<EmbeddableAssignmentModel>  {
    return await this.embeddableAssignmentService.upsert(
      courseId,
      body,
      assignmentId,
    );
  }

  /**
   * For deleting an embeddable question. Accessible to TA and Professor roles only.
   * @param courseId
   * @param assignmentId
   * */
  @Delete(':courseId/:assignmentId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async delete(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ): Promise<void> {
    await this.embeddableAssignmentService.delete(assignmentId);
  }

  /**
   * For retrieving feedback from a given editable question. Accessible to TA and Professor roles only.
   * @param courseId
   * @param assignmentId The assignment ID to retrieve questions for
   * @param users (Optional) Filter to certain students
   */
  @Get(':courseId/answers/:assignmentId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async getAnswers(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Query('users', new ParseArrayPipe({ items: Number, optional: true })) users?: number[],
  ): Promise<EmbeddableAssignmentFeedbackModel[]> {
    return await this.embeddableAssignmentService.getAnswers(assignmentId, undefined, users)
  }

  @Patch(':courseId/answers/:answerId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async updateAnswer(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('answerId', ParseIntPipe) answerId: number,
    @Body() body: UpdateEmbeddableFeedbackParams
  ): Promise<EmbeddableAssignmentFeedbackModel> {
    return await this.embeddableAssignmentService.updateAnswer(answerId,body);
  }

  @Delete(':courseId/answers/:answerId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async deleteAnswer(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('answerId', ParseIntPipe) answerId: number,
  ): Promise<void> {
    await this.embeddableAssignmentService.deleteAnswer(answerId);
  }

  @Post(':courseId/export')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async exportAssignmentAnswers(
    @Res() response: Response,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: ExportEmbeddableAssignmentResultsParams,
  ): Promise<void> {
    const { assignmentId, includeAiFeedback, includeNonSubmitters } = body;

    const data = await this.embeddableAssignmentService.exportFeedback(
      courseId,
      assignmentId,
      includeAiFeedback,
      includeNonSubmitters
    );

    response
      .status(200)
      .set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(data)
  }
}