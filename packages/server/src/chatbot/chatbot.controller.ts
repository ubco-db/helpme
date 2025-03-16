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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ChatbotQuestionModel } from './question.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import {
  ChatbotAskResponse,
  ChatbotQuestionResponseHelpMeDB,
  ChatbotSettings,
  ChatbotSettingsMetadata,
  GetInteractionsAndQuestionsResponse,
  Role,
  AddChatbotQuestionParams,
  ChatbotAskParams,
  ChatbotAskSuggestedParams,
  UpdateDocumentChunkParams,
  InteractionResponse,
  AddDocumentChunkParams,
  ChatbotQuestionResponseChatbotDB,
  UpdateQuestionParams,
  UpdateChatbotQuestionParams,
} from '@koh/common';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { Roles } from 'decorators/roles.decorator';
import { ChatbotApiService } from './chatbot-api.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserModel } from '../profile/user.entity';
import { User, UserId } from '../decorators/user.decorator';
import * as Sentry from '@sentry/nestjs';

@Controller('chatbot')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly chatbotApiService: ChatbotApiService,
  ) {}

  //
  // Endpoints for both students and staff
  //
  @Post('ask/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async askQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body()
    { question, history, interactionId, onlySaveInChatbotDB }: ChatbotAskParams,
    @User(['chat_token']) user: UserModel,
  ): Promise<ChatbotAskResponse> {
    handleChatbotTokenCheck(user);

    const ChatbotDBResponse = await this.chatbotApiService.askQuestion(
      question,
      history,
      user.chat_token.token,
      courseId,
    );

    if (!onlySaveInChatbotDB) {
      // if there's no interactionId (it's the first question), create a new interaction
      if (!interactionId) {
        const interaction = await this.chatbotService.createInteraction(
          courseId,
          user.id,
        );
        interactionId = interaction.id;
      }
      const HelpMeDBResponse = await this.chatbotService.createQuestion({
        questionText: question,
        responseText: ChatbotDBResponse.answer,
        vectorStoreId: ChatbotDBResponse.questionId,
        suggested: false,
        isPreviousQuestion: ChatbotDBResponse.isPreviousQuestion ?? false,
        interactionId: interactionId,
      });

      return {
        chatbotRepoVersion: ChatbotDBResponse,
        helpmeRepoVersion: {
          ...HelpMeDBResponse,
          interactionId: interactionId,
        },
      };
    } else {
      return {
        chatbotRepoVersion: ChatbotDBResponse,
        helpmeRepoVersion: null,
      };
    }
  }

  @Post('askSuggested/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async askSuggestedQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body()
    { question, responseText, vectorStoreId }: ChatbotAskSuggestedParams,
    @UserId() userId: number, // this is the only chatbot endpoint that doesn't need the chat token since it doesn't require contacting the chatbot repo
  ): Promise<ChatbotQuestionResponseHelpMeDB> {
    const interaction = await this.chatbotService.createInteraction(
      courseId,
      userId,
    );

    const HelpMeDBResponse = await this.chatbotService.createQuestion({
      questionText: question,
      responseText: responseText,
      vectorStoreId: vectorStoreId,
      suggested: true,
      isPreviousQuestion: true,
      interactionId: interaction.id,
    });

    return {
      ...HelpMeDBResponse,
      interactionId: interaction.id,
    };
  }

  @Get('question/suggested/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getSuggestedQuestions(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.getSuggestedQuestions(
      courseId,
      user.chat_token.token,
    );
  }

  @Patch('question/:courseId/:questionId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA, Role.STUDENT)
  async updateChatbotUserScore(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId') questionId: number, // helpme question id
    @Body() userScore: number,
  ) {
    return await this.chatbotService.updateQuestionUserScore(
      questionId,
      userScore,
    );
  }

  //
  // Endpoints for Staff-only
  //

  // Settings endpoints
  @Get('settings/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getChatbotSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User(['chat_token']) user: UserModel,
  ): Promise<ChatbotSettings> {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.getChatbotSettings(
      courseId,
      user.chat_token.token,
    );
  }

  @Patch('settings/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async updateChatbotSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() settings: ChatbotSettingsMetadata,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.updateChatbotSettings(
      settings,
      courseId,
      user.chat_token.token,
    );
  }

  @Patch('settings/:courseId/reset')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async resetChatbotSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.resetChatbotSettings(
      courseId,
      user.chat_token.token,
    );
  }

  // Question endpoints
  @Get('question/all/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getInteractionsAndQuestions(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User(['chat_token']) user: UserModel,
  ): Promise<GetInteractionsAndQuestionsResponse> {
    handleChatbotTokenCheck(user);
    // Fire off both requests simultaneously.
    const [interactions, allChatbotDBQuestions] = await Promise.all([
      this.chatbotService.getInteractionsAndQuestions(courseId), // helpme db
      this.chatbotApiService.getAllQuestions(courseId, user.chat_token.token), // chatbot db
    ]);
    return {
      helpmeDB: interactions as unknown as InteractionResponse[], // interactions is of type InteractionModel[] which is basically the same
      chatbotDB: allChatbotDBQuestions,
    };
  }

  @Post('question/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async addChatbotQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() questionData: AddChatbotQuestionParams,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    // NOTE that this endpoint does NOT add the question to the helpme database
    // (since the helpme database only hold questions that were actually asked)
    return await this.chatbotApiService.addQuestion(
      questionData,
      courseId,
      user.chat_token.token,
    );
  }

  @Patch('question/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async updateChatbotQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() questionData: UpdateChatbotQuestionParams,
    @User(['chat_token']) user: UserModel,
  ): Promise<ChatbotQuestionResponseChatbotDB> {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.updateQuestion(
      questionData,
      courseId,
      user.chat_token.token,
    );
  }

  @Delete('question/:courseId/:questionId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async deleteChatbotQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId') questionId: string,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.deleteQuestion(
      questionId,
      courseId,
      user.chat_token.token,
    );
  }

  // Unused
  // @Delete('question/all/:courseId')
  // @UseGuards(CourseRolesGuard)
  // @Roles(Role.PROFESSOR, Role.TA)
  // async deleteAllQuestions(
  //   @Param('courseId', ParseIntPipe) courseId: number,
  //   @User(['chat_token']) user: UserModel,
  // ) {
  //   handleChatbotTokenCheck(user);
  //   return await this.chatbotApiService.deleteAllQuestions(courseId, user.chat_token.token);
  // }

  // resets all chatbot data for the course. Unused
  // @Get('resetCourse/:courseId')
  // @UseGuards(CourseRolesGuard)
  // @Roles(Role.PROFESSOR, Role.TA)
  // async resetCourse(
  //   @Param('courseId', ParseIntPipe) courseId: number,
  //   @User(['chat_token']) user: UserModel,
  // ) {
  //   handleChatbotTokenCheck(user)
  //   return await this.chatbotApiService.resetCourse(courseId, user.chat_token.token);
  // }

  // Document endpoints
  @Get('aggregateDocuments/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getAllAggregateDocuments(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    // this gets the full chatbot documents (rather than just the chunks)
    return await this.chatbotApiService.getAllAggregateDocuments(
      courseId,
      user.chat_token.token,
    );
  }

  @Get('documentChunks/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getAllDocumentChunks(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.getAllDocumentChunks(
      courseId,
      user.chat_token.token,
    );
  }

  @Post('documentChunks/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async addDocumentChunk(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: AddDocumentChunkParams,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.addDocumentChunk(
      body,
      courseId,
      user.chat_token.token,
    );
  }

  @Patch('documentChunks/:courseId/:docId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async updateDocumentChunk(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('docId') docId: string,
    @Body() body: UpdateDocumentChunkParams,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.updateDocumentChunk(
      docId,
      body,
      courseId,
      user.chat_token.token,
    );
  }

  @Delete('documentChunks/:courseId/:docId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async deleteDocumentChunk(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('docId') docId: string,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.deleteDocumentChunk(
      docId,
      courseId,
      user.chat_token.token,
    );
  }

  @Delete('documents/:courseId/:docId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async deleteDocument(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('docId') docId: string,
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.deleteDocument(
      docId,
      courseId,
      user.chat_token.token,
    );
  }

  @Post('documents/:courseId/upload')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 1024 * 1024 * 80, // 80MB
      },
    }),
  )
  async uploadDocument(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() { source, parseAsPng }: { source: string; parseAsPng: boolean },
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return await this.chatbotApiService.uploadDocument(
      file,
      source,
      parseAsPng,
      courseId,
      user.chat_token.token,
    );
  }

  @Post('documents/:courseId/github')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async addDocumentFromGithub(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() { url }: { url: string },
    @User(['chat_token']) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.addDocumentFromGithub(
      url,
      courseId,
      user.chat_token.token,
    );
  }
}

function handleChatbotTokenCheck(user: UserModel) {
  if (!user.chat_token) {
    Sentry.captureMessage('User has no chat token: ' + user.id);
    throw new HttpException('User has no chat token', HttpStatus.FORBIDDEN);
  }
}
