import {
  Controller,
  Post,
  Body,
  UseGuards,
  Patch,
  Delete,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ChatbotQuestionModel } from './question.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import {
  ChatbotQuestion,
  GetInteractionsAndQuestionsResponse,
  InteractionParams,
  Role,
} from '@koh/common';
import { InteractionModel } from './interaction.entity';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { Roles } from 'decorators/roles.decorator';

@Controller('chatbot')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class ChatbotController {
  constructor(private readonly ChatbotService: ChatbotService) {}
  @Post('interaction')
  async addInteraction(
    @Body() body: InteractionParams,
  ): Promise<InteractionModel> {
    return await this.ChatbotService.createInteraction(body);
  }

  @Post('question')
  async addQuestion(
    @Body() body: ChatbotQuestion,
  ): Promise<ChatbotQuestionModel> {
    return await this.ChatbotService.createQuestion(body);
  }

  @Patch('question')
  async editQuestion(
    @Body()
    body: ChatbotQuestion,
  ) {
    return await this.ChatbotService.editQuestion(body);
  }

  // unused
  // @Delete('question')
  // async deleteQuestion(@Body() body: { questionId: number }) {
  //   return await this.ChatbotService.deleteQuestion(body.questionId);
  // }

  @Get('questions/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async getInteractionsAndQuestions(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<GetInteractionsAndQuestionsResponse> {
    const interactions =
      await this.ChatbotService.getInteractionsAndQuestions(courseId);
    return interactions as unknown as GetInteractionsAndQuestionsResponse;
  }
}
