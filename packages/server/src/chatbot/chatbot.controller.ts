import {
  Controller,
  Post,
  Body,
  UseGuards,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ChatbotQuestionModel } from './question.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { ChatbotQuestion, InteractionParams } from '@koh/common';
import { InteractionModel } from './interaction.entity';

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

  @Delete('question')
  async deleteQuestion(@Body() body: { questionId: number }) {
    return await this.ChatbotService.deleteQuestion(body.questionId);
  }
}
