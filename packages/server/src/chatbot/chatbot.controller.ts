import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ChatbotService,
  buildChatbotDocumentUploadPipe,
} from './chatbot.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import {
  AddChatbotQuestionParams,
  AddDocumentChunkParams,
  ChatbotAskParams,
  ChatbotAskResponse,
  ChatbotAskSuggestedParams,
  ChatbotAgentCourse,
  ChatbotProvider,
  ChatbotQueryParams,
  ChatbotQuestionResponseChatbotDB,
  ChatbotQuestionResponseHelpMeDB,
  ChatbotServiceProvider,
  ChatbotServiceType,
  ChatbotSettings,
  ChatbotSettingsUpdateParams,
  CourseChatbotSettings,
  CourseChatbotSettingsForm,
  CreateChatbotProviderBody,
  CreateLLMTypeBody,
  CreateOrganizationChatbotSettingsBody,
  ERROR_MESSAGES,
  GetAvailableModelsBody,
  GetChatbotHistoryResponse,
  GetInteractionsAndQuestionsResponse,
  InteractionResponse,
  LLMType,
  LocalLLMType,
  OllamaLLMType,
  OpenAILLMType,
  OrganizationChatbotSettings,
  OrganizationChatbotSettingsDefaults,
  OrganizationRole,
  Role,
  SuperCoursePurpose,
  UpdateChatbotProviderBody,
  UpdateChatbotQuestionParams,
  UpdateDocumentChunkParams,
  UpdateLLMTypeBody,
  UpsertCourseChatbotSettings,
  UploadChatbotDocumentRequest,
} from '@koh/common';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { Roles } from 'decorators/roles.decorator';
import { ChatbotApiService } from './chatbot-api.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserModel } from '../profile/user.entity';
import { User, UserId } from '../decorators/user.decorator';
import * as Sentry from '@sentry/nestjs';
import { CourseRolesConditionalBypassGuard } from 'guards/course-roles-conditional-bypass.guard';
import { CourseModel } from 'course/course.entity';
import { SuperCourseModel } from 'course/super-course.entity';
import { ChatbotDocPdfModel } from './chatbot-doc-pdf.entity';
import { Request, Response } from 'express';
import { OrganizationRolesGuard } from '../guards/organization-roles.guard';
import { OrganizationGuard } from '../guards/organization.guard';
import { OrganizationChatbotSettingsModel } from './chatbot-infrastructure-models/organization-chatbot-settings.entity';
import { ChatbotProviderModel } from './chatbot-infrastructure-models/chatbot-provider.entity';
import { LLMTypeModel } from './chatbot-infrastructure-models/llm-type.entity';
import { CourseChatbotSettingsModel } from './chatbot-infrastructure-models/course-chatbot-settings.entity';
import { OrgOrCourseRolesGuard } from '../guards/org-or-course-roles.guard';
import { CourseRoles } from '../decorators/course-roles.decorator';
import { OrgRoles } from '../decorators/org-roles.decorator';
import { ChatbotLegacyEndpointGuard } from '../guards/chatbot-legacy-endpoint.guard';
import { OrganizationCourseModel } from '../organization/organization-course.entity';
import { pick } from 'lodash';
import {
  IgnoreableClassSerializerInterceptor,
  IgnoreSerializer,
} from '../interceptors/IgnoreableClassSerializerInterceptor';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as checkDiskSpaceModule from 'check-disk-space';
import * as fs from 'fs';
import * as path from 'path';
import { ChatbotDocumentUploadJobData } from './chatbot-document-upload.consumer';
import { memoryStorage } from 'multer';

const checkDiskSpace =
  (checkDiskSpaceModule as any).default || checkDiskSpaceModule;

@Controller('chatbot')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@UseInterceptors(IgnoreableClassSerializerInterceptor)
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly chatbotApiService: ChatbotApiService,
    @InjectQueue('chatbot-document-upload')
    private readonly documentUploadQueue: Queue<ChatbotDocumentUploadJobData>,
  ) {}

  //
  // Endpoints for both students and staff
  //

  @Post('query/:courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async queryChatbot(
    @Body() { query, type }: ChatbotQueryParams,
    @User({ chat_token: true }) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);

    return await this.chatbotApiService.queryChatbot(
      query,
      user.chat_token.token,
      type,
    );
  }

  @Post('ask/:courseId')
  @UseGuards(CourseRolesConditionalBypassGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async askQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body()
    { question, history, interactionId, onlySaveInChatbotDB }: ChatbotAskParams,
    @User({ chat_token: true }) user: UserModel,
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
  @UseGuards(CourseRolesConditionalBypassGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async askSuggestedQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body()
    { question, responseText, vectorStoreId }: ChatbotAskSuggestedParams,
    @UserId() userId: number,
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
  @UseGuards(CourseRolesConditionalBypassGuard)
  @Roles(Role.PROFESSOR, Role.TA, Role.STUDENT)
  async getSuggestedQuestions(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User({ chat_token: true }) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.getSuggestedQuestions(
      courseId,
      user.chat_token.token,
    );
  }

  @Get('course/:courseId/agents')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getChatbotAgents(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<ChatbotAgentCourse[]> {
    const superCourse = await SuperCourseModel.findGroupForCourse(
      courseId,
      SuperCoursePurpose.CHATBOT_AGENT_GROUP,
    );

    if (!superCourse) {
      return [];
    }

    const requestedCourse = superCourse.courses.find(
      (groupCourse) => groupCourse.id === courseId,
    );
    if (!requestedCourse) {
      return [];
    }
    const showArchivedAgents = requestedCourse.enabled === false;

    return superCourse.courses
      .filter(
        (groupCourse) =>
          groupCourse.chatbotAgentName &&
          (showArchivedAgents || groupCourse.enabled !== false),
      )
      .sort(
        (a, b) =>
          (a.chatbotAgentOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.chatbotAgentOrder ?? Number.MAX_SAFE_INTEGER) ||
          a.name.localeCompare(b.name),
      )
      .map((groupCourse) => ({
        courseId: groupCourse.id,
        name: groupCourse.name,
        agentName: groupCourse.chatbotAgentName,
        description: groupCourse.chatbotAgentDescription,
        order: groupCourse.chatbotAgentOrder,
      }));
  }

  @Patch('questionScore/:courseId/:questionId')
  @UseGuards(CourseRolesConditionalBypassGuard)
  @Roles(Role.PROFESSOR, Role.TA, Role.STUDENT)
  async updateChatbotUserScore(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId') questionId: number, // helpme question id
    @Body() { userScore }: { userScore: number },
  ) {
    return await this.chatbotService.updateQuestionUserScore(
      questionId,
      userScore,
    );
  }

  @Get('history')
  async getChatbotHistory(
    @UserId() userId: number,
  ): Promise<GetChatbotHistoryResponse> {
    const history = await this.chatbotService.getAllInteractionsForUser(userId);
    return {
      history: history as unknown as InteractionResponse[],
    };
  }

  //
  // Endpoints for Staff-only
  //

  // Settings endpoints
  @Get('settings/:courseId')
  @UseGuards(CourseRolesGuard, ChatbotLegacyEndpointGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getChatbotSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User({ chat_token: true }) user: UserModel,
  ): Promise<ChatbotSettings> {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.getChatbotSettings(
      courseId,
      user.chat_token.token,
    );
  }

  @Patch('settings/:courseId')
  @UseGuards(CourseRolesGuard, ChatbotLegacyEndpointGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async updateChatbotSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() settings: ChatbotSettingsUpdateParams,
    @User({ chat_token: true }) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.updateChatbotSettings(
      settings,
      courseId,
      user.chat_token.token,
    );
  }

  @Patch('settings/:courseId/reset')
  @UseGuards(CourseRolesGuard, ChatbotLegacyEndpointGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async resetChatbotSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User({ chat_token: true }) user: UserModel,
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
    @User({ chat_token: true }) user: UserModel,
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
    @User({ chat_token: true }) user: UserModel,
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
    @User({ chat_token: true }) user: UserModel,
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
    @User({ chat_token: true }) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.deleteQuestion(
      questionId,
      courseId,
      user.chat_token.token,
    );
  }

  @Get('models/:courseId')
  @UseGuards(CourseRolesGuard, ChatbotLegacyEndpointGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getModels(
    @Param('courseId', ParseIntPipe) _courseId: number,
    @User({ chat_token: true }) user: UserModel,
  ): Promise<ChatbotSettings> {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.getModels(user.chat_token.token);
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
    @User({ chat_token: true }) user: UserModel,
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
    @User({ chat_token: true }) user: UserModel,
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
    @User({ chat_token: true }) user: UserModel,
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
    @User({ chat_token: true }) user: UserModel,
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
    @User({ chat_token: true }) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.deleteDocumentChunk(
      docId,
      courseId,
      user.chat_token.token,
    );
  }

  @Delete('document/:courseId/:docId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async deleteDocument(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('docId') docId: string,
    @User({ chat_token: true }) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    const chatbotDeleteResponse = await this.chatbotApiService.deleteDocument(
      docId,
      courseId,
      user.chat_token.token,
    );
    // if that succeeded (an error would have been thrown if it didn't), then delete the document from database
    await ChatbotDocPdfModel.delete({
      docIdChatbotDB: docId,
    });
    return chatbotDeleteResponse;
  }

  // TODO: eventually add tests for this I guess
  // note that there is no corresponding endpoint for this one on the frontend as you are supposed to make links to it
  @Get('document/:courseId/:docId')
  @UseGuards(CourseRolesConditionalBypassGuard)
  @IgnoreSerializer()
  @Roles(Role.PROFESSOR, Role.TA, Role.STUDENT)
  async getChatbotDocument(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('docId') docId: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // First check if document exists and get its metadata
      const docInfo = await ChatbotDocPdfModel.createQueryBuilder('doc')
        .select([
          'doc."docName" as "doc_docName"',
          'LENGTH(doc."docData") as "file_size"',
        ])
        .where('doc."idHelpMeDB" = :docId', { docId })
        .getRawOne<{ doc_docName: string; file_size: string }>();

      if (!docInfo) {
        return res
          .set({
            'Content-Type': 'text/plain',
          })
          .status(HttpStatus.NOT_FOUND)
          .send('Document not found');
      }

      const fileSize = parseInt(docInfo.file_size, 10);
      const fileName = docInfo.doc_docName + '.pdf';

      // Set headers for inline display
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=12600000', // 4 months
      });

      // Handle range requests (partial content for large PDFs)
      const range = req.headers.range;

      // Set up default range values
      let start = 0;
      let end = fileSize - 1;

      if (range) {
        // Parse the range header
        const parts = range.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10);
        if (parts[1] && parts[1].trim() !== '') {
          end = parseInt(parts[1], 10);
        }

        // Validate range
        if (
          isNaN(start) ||
          isNaN(end) ||
          start >= fileSize ||
          end >= fileSize ||
          start < 0 ||
          end < 0
        ) {
          // Invalid range, return 416 Range Not Satisfiable
          res.status(416);
          res.set('Content-Range', `bytes */${fileSize}`);
          return res.end();
        }

        // Set partial content headers
        const chunkSize = end - start + 1;
        res.status(206);
        res.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.set('Content-Length', chunkSize.toString());
      } else {
        // For non-range requests, set Content-Length for the full document
        res.set('Content-Length', fileSize.toString());
      }

      // Create a query to select only the requested bytes using SUBSTRING
      // PostgreSQL's SUBSTRING is 1-indexed
      const stream = await ChatbotDocPdfModel.createQueryBuilder('doc')
        .select(
          `SUBSTRING(doc."docData" FROM ${start + 1} FOR ${end - start + 1}) as chunk`,
        )
        .where('doc."idHelpMeDB" = :docId', { docId })
        .stream();

      // Don't pipe directly - we need to transform each row
      stream.on('data', (data: any) => {
        // TypeORM with pg-query-stream returns an object with the selected columns as properties
        if (data && data.chunk) {
          res.write(data.chunk);
        }
      });

      stream.on('end', () => {
        res.end();
      });

      // Handle stream errors
      stream.on('error', (err) => {
        console.error('Error streaming document:', err);
        if (!res.headersSent) {
          res
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .send('Error streaming document');
        } else {
          res.end();
        }
      });
    } catch (error) {
      console.error('Error retrieving document:', error);
      if (!res.headersSent) {
        return res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send('Error retrieving document');
      }
    }
  }

  // TODO: eventually add tests for this I guess
  @Post('document/:courseId/upload')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async uploadDocument(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UploadedFile(buildChatbotDocumentUploadPipe())
    file: Express.Multer.File,
    @Body()
    body: UploadChatbotDocumentRequest,
    @User({ chat_token: true }) user: UserModel,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { uploadId } = body;
    let { parseAsPng } = body;
    handleChatbotTokenCheck(user);
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    // if the file is a text file (including markdown and csv), don't allow sizes over 2 MB (since 4MB of text is actually a lot)
    if (
      fileExtension === 'txt' ||
      fileExtension === 'csv' ||
      fileExtension === 'md'
    ) {
      if (file.size > 1024 * 2048) {
        throw new BadRequestException(
          'Text-only files (.txt, .csv, .md) must be less than 2MB (2MB of text is a lot)',
        );
      }
    }

    // Check server disk space (same pattern as profile.service.ts)
    const serverSpaceLeft = await checkDiskSpace(
      path.parse(process.cwd()).root,
    );
    if (serverSpaceLeft.free < 1_000_000_000) {
      const err = new ServiceUnavailableException(
        ERROR_MESSAGES.common.noDiskSpace,
      );
      Sentry.captureException(err, {
        extra: {
          freeSpace: serverSpaceLeft.free,
          location: 'server root',
        },
      });
      throw err;
    }

    // Check temp upload directory disk space (max 4GB of temp files allowed)
    const tempUploadDir = path.resolve(
      process.env.UPLOAD_LOCATION,
      'temp_chatbot_uploads',
    );
    // Ensure the temp upload directory exists
    if (!fs.existsSync(tempUploadDir)) {
      fs.mkdirSync(tempUploadDir, { recursive: true });
    }
    const tempSpaceLeft = await checkDiskSpace(tempUploadDir);
    if (tempSpaceLeft.free < 1_000_000_000) {
      const err = new ServiceUnavailableException(
        'Not enough disk space available for temporary file uploads',
      );
      Sentry.captureException(err, {
        extra: {
          freeSpace: tempSpaceLeft.free,
          location: tempUploadDir,
        },
      });
      throw err;
    }

    // Also check if the temp directory itself has exceeded the 4GB cap
    const dirFiles = fs.readdirSync(tempUploadDir);
    let totalSize = 0;
    for (const f of dirFiles) {
      const stats = fs.statSync(path.join(tempUploadDir, f));
      totalSize += stats.size;
    }
    const MAX_TEMP_DIR_SIZE = 4 * 1024 * 1024 * 1024; // 4GB
    if (totalSize + file.size > MAX_TEMP_DIR_SIZE) {
      const err = new ServiceUnavailableException(
        'Temporary upload directory is full (4GB limit). Please try again later.',
      );
      Sentry.captureException(err, {
        extra: {
          currentSize: totalSize,
          fileSize: file.size,
          maxSize: MAX_TEMP_DIR_SIZE,
        },
      });
      throw err;
    }

    // if it's an image, make parseAsPng true
    if (file.mimetype.startsWith('image/')) {
      parseAsPng = true;
    }

    // Save file to disk
    const tempFileName = `${user.id}-${Date.now()}-${path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 200)}.tempfile`;
    const tempFilePath = path.join(tempUploadDir, tempFileName);
    await fs.promises.writeFile(tempFilePath, file.buffer);

    // Enqueue the job for background processing
    await this.documentUploadQueue.add(
      'process-document',
      {
        filePath: tempFilePath,
        originalname: file.originalname,
        mimetype: file.mimetype,
        courseId,
        userId: user.id,
        parseAsPng,
        uploadId: uploadId || '',
      },
      {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    res.status(HttpStatus.ACCEPTED);
    return { message: 'Document upload queued for processing' };
  }

  @Post('document/:courseId/github')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async addDocumentFromGithub(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() { url }: { url: string },
    @User({ chat_token: true }) user: UserModel,
  ) {
    handleChatbotTokenCheck(user);
    return await this.chatbotApiService.uploadURLDocument(
      url,
      courseId,
      user.chat_token.token,
    );
  }

  @Get('organization/:oid')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async getOrganizationSettings(
    @Param('oid', ParseIntPipe) organizationId: number,
  ): Promise<OrganizationChatbotSettings> {
    return await OrganizationChatbotSettingsModel.findOneOrFail({
      where: { organizationId },
      relations: {
        providers: {
          defaultModel: true,
          defaultVisionModel: true,
          availableModels: true,
        },
        defaultProvider: {
          defaultModel: true,
          defaultVisionModel: true,
          availableModels: true,
        },
        courseSettingsInstances: true,
      },
    }).catch(() => {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    });
  }

  @Post('organization/:oid')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async createOrganizationSettings(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Body() body: CreateOrganizationChatbotSettingsBody,
  ): Promise<OrganizationChatbotSettings> {
    const existingSettings = await OrganizationChatbotSettingsModel.findOne({
      where: { organizationId },
    });
    if (existingSettings) {
      throw new BadRequestException(
        ERROR_MESSAGES.chatbotController.organizationSettingsAlreadyExists,
      );
    }
    return await this.chatbotService.createOrganizationSettings(
      organizationId,
      body,
    );
  }

  @Patch('organization/:oid')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async updateOrganizationSettings(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Body() body: OrganizationChatbotSettingsDefaults,
  ): Promise<OrganizationChatbotSettings> {
    const original = await OrganizationChatbotSettingsModel.findOne({
      where: { organizationId },
      relations: {
        providers: {
          defaultModel: true,
          defaultVisionModel: true,
          availableModels: true,
        },
      },
    });
    if (!original) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    }
    return await this.chatbotService.updateOrganizationSettings(original, body);
  }

  @Delete('organization/:oid')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async deleteOrganizationSettings(
    @Param('oid', ParseIntPipe) organizationId: number,
    @User({ chat_token: true }) user: UserModel,
  ): Promise<void> {
    const original = await OrganizationChatbotSettingsModel.findOne({
      where: { organizationId },
    });
    if (!original) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    }
    handleChatbotTokenCheck(user);
    const applicableCourses = await CourseChatbotSettingsModel.find({
      where: {
        organizationSettings: {
          organizationId,
        },
      },
    });

    await this.chatbotService.deleteOrganizationSettings(organizationId);

    // Reset courses to legacy state
    for (const course of applicableCourses) {
      const params = pick(course, [
        'prompt',
        'topK',
        'temperature',
        'similarityThresholdDocuments',
        'similarityThresholdQuestions',
      ]);
      const usingDefaults = pick(course, [
        'usingDefaultPrompt',
        'usingDefaultTopK',
        'usingDefaultTemperature',
        'usingDefaultSimilarityThresholdDocuments',
        'usingDefaultSimilarityThresholdQuestions',
      ]);
      Object.keys(params).forEach((k0) => {
        Object.keys(usingDefaults).forEach((k1) => {
          if (k1.toLowerCase().includes(k0)) {
            if (usingDefaults[k1]) {
              delete params[k0];
            }
          }
        });
      });

      // Reset to defaults
      await this.chatbotApiService.resetChatbotSettings(
        course.courseId,
        user.chat_token.token,
      );
      // Update with any modified values
      await this.chatbotApiService.updateChatbotSettings(
        params,
        course.courseId,
        user.chat_token.token,
      );
    }
  }

  @Get('organization/:oid/course')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async getOrganizationCourseSettings(
    @Param('oid', ParseIntPipe) organizationId: number,
  ): Promise<CourseChatbotSettings[]> {
    return await CourseChatbotSettingsModel.find({
      where: { course: { organizationCourse: { organizationId } } },
      relations: {
        course: true,
        llmModel: {
          provider: true,
        },
      },
    });
  }

  @Get('organization/:oid/provider')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async getOrganizationProviders(
    @Param('oid', ParseIntPipe) organizationId: number,
  ): Promise<ChatbotProvider[]> {
    return await ChatbotProviderModel.find({
      where: { organizationChatbotSettings: { organizationId } },
      relations: {
        defaultModel: true,
        defaultVisionModel: true,
        availableModels: true,
      },
    });
  }

  @Post('organization/:oid/provider')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async createChatbotProvider(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Body() body: CreateChatbotProviderBody,
  ): Promise<ChatbotProvider> {
    const existingSettings = await OrganizationChatbotSettingsModel.findOne({
      where: { organizationId },
    });
    if (!existingSettings) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    }
    return await this.chatbotService.createChatbotProvider(
      existingSettings,
      body,
    );
  }

  @Patch('organization/:oid/provider/:providerId')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async updateChatbotProvider(
    @Param('providerId', ParseIntPipe) providerId: number,
    @Body() body: UpdateChatbotProviderBody,
  ): Promise<ChatbotProvider> {
    const provider = await ChatbotProviderModel.findOne({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.chatbotProviderNotFound,
      );
    }
    return await this.chatbotService.updateChatbotProvider(provider, body);
  }

  @Delete('organization/:oid/provider/:providerId')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async deleteChatbotProvider(
    @Param('providerId', ParseIntPipe) providerId: number,
  ): Promise<void> {
    const provider = await ChatbotProviderModel.findOne({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.chatbotProviderNotFound,
      );
    }
    await this.chatbotService.deleteChatbotProvider(providerId);
  }

  @Post('organization/:oid/model')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async createLLMType(@Body() body: CreateLLMTypeBody): Promise<LLMType> {
    const { providerId } = body;
    const existingProvider = await ChatbotProviderModel.findOne({
      where: { id: providerId },
    });
    if (!existingProvider) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.chatbotProviderNotFound,
      );
    }
    return await this.chatbotService.createLLMType(body);
  }

  @Patch('organization/:oid/model/:modelId')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async updateLLMType(
    @Param('modelId', ParseIntPipe) modelId: number,
    @Body() body: UpdateLLMTypeBody,
  ): Promise<LLMType> {
    const llmType = await LLMTypeModel.findOne({ where: { id: modelId } });
    if (!llmType) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.modelNotFound,
      );
    }
    return await this.chatbotService.updateLLMType(llmType, body);
  }

  @Delete('organization/:oid/model/:modelId')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async deleteLLMType(
    @Param('modelId', ParseIntPipe) modelId: number,
  ): Promise<void> {
    const llmType = await LLMTypeModel.findOne({ where: { id: modelId } });
    if (!llmType) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.modelNotFound,
      );
    }
    await this.chatbotService.deleteLLMType(modelId);
  }

  @Get('course/:courseId')
  @UseGuards(OrgOrCourseRolesGuard)
  @OrgRoles(OrganizationRole.ADMIN)
  @CourseRoles(Role.PROFESSOR, Role.TA)
  async getCourseSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<CourseChatbotSettings> {
    const course = await CourseModel.findOne({
      where: { id: courseId },
      relations: {
        organizationCourse: true,
      },
    });
    const orgSettings = await OrganizationChatbotSettingsModel.findOneOrFail({
      where: { organizationId: course.organizationCourse?.organizationId },
    }).catch(() => {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    });
    return await CourseChatbotSettingsModel.findOneOrFail({
      where: { courseId },
      relations: {
        llmModel: {
          provider: {
            defaultModel: true,
            defaultVisionModel: true,
          },
        },
      },
    }).catch(
      async () =>
        await this.chatbotService.upsertCourseSetting(
          orgSettings,
          courseId,
          {},
        ),
    );
  }

  @Get('course/:courseId/service')
  @UseGuards(OrgOrCourseRolesGuard)
  @OrgRoles(OrganizationRole.ADMIN)
  @CourseRoles(Role.PROFESSOR, Role.TA)
  async getCourseServiceType(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<ChatbotServiceType> {
    return (await this.chatbotService.isChatbotServiceLegacy(courseId))
      ? ChatbotServiceType.LEGACY
      : ChatbotServiceType.LATEST;
  }

  @Post('course/:courseId')
  @UseGuards(OrgOrCourseRolesGuard)
  @OrgRoles(OrganizationRole.ADMIN)
  @CourseRoles(Role.PROFESSOR, Role.TA)
  async upsertCourseSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: UpsertCourseChatbotSettings,
  ): Promise<CourseChatbotSettings> {
    const course = await CourseModel.findOne({
      where: { id: courseId },
      relations: { organizationCourse: true },
    });
    const orgSettings = await OrganizationChatbotSettingsModel.findOne({
      where: { organizationId: course.organizationCourse.organizationId },
    });
    if (!orgSettings) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    }

    return await this.chatbotService.upsertCourseSetting(
      orgSettings,
      courseId,
      body,
    );
  }

  @Patch('course/:courseId/reset')
  @UseGuards(OrgOrCourseRolesGuard)
  @OrgRoles(OrganizationRole.ADMIN)
  @CourseRoles(Role.PROFESSOR, Role.TA)
  async resetCourseSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<CourseChatbotSettings> {
    return await this.chatbotService.resetCourseSetting(courseId);
  }

  @Get('course/:courseId/default')
  @UseGuards(OrgOrCourseRolesGuard)
  @OrgRoles(OrganizationRole.ADMIN)
  @CourseRoles(Role.PROFESSOR, Role.TA)
  async getCourseSettingsDefaults(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<CourseChatbotSettingsForm> {
    return await this.chatbotService.getCourseSettingDefaults(courseId);
  }

  @Get('course/:courseId/provider')
  @UseGuards(OrgOrCourseRolesGuard)
  @OrgRoles(OrganizationRole.ADMIN)
  @CourseRoles(Role.PROFESSOR, Role.TA)
  async getCourseOrganizationProviders(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<ChatbotProvider[]> {
    const orgCourse = await OrganizationCourseModel.findOne({
      where: { courseId },
    });
    const orgSettings = await OrganizationChatbotSettingsModel.findOne({
      where: { organizationId: orgCourse?.organizationId },
      relations: {
        providers: {
          defaultModel: true,
          availableModels: true,
        },
        defaultProvider: {
          defaultModel: true,
          availableModels: true,
        },
      },
    });
    if (!orgSettings) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    }
    return [
      orgSettings.defaultProvider,
      ...orgSettings.providers.filter(
        (p) => p.id != orgSettings.defaultProviderId,
      ),
    ];
  }

  @Post('organization/:oid/ollama')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async getAvailableOllamaModels(
    @Body() body: GetAvailableModelsBody,
  ): Promise<OllamaLLMType[]> {
    const { baseUrl, headers } = body;
    if (!baseUrl) {
      throw new BadRequestException(
        ERROR_MESSAGES.chatbotController.invalidProviderParams(['Base URL']),
      );
    }
    return await this.chatbotService.getOllamaAvailableModels(baseUrl, headers);
  }

  @Post('organization/:oid/openai')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async getAvailableOpenAIModels(
    @Body() body: GetAvailableModelsBody,
  ): Promise<OpenAILLMType[]> {
    const { apiKey, headers } = body;
    if (!apiKey) {
      throw new BadRequestException(
        ERROR_MESSAGES.chatbotController.invalidProviderParams(['API Key']),
      );
    }
    return await this.chatbotService.getOpenAIAvailableModels(apiKey, headers);
  }

  @Post('organization/:oid/local_llm')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async getAvailableLocalLLMModels(
    @Body() body: GetAvailableModelsBody,
  ): Promise<LocalLLMType[]> {
    const { baseUrl, headers } = body;
    if (!baseUrl) {
      throw new BadRequestException(
        ERROR_MESSAGES.chatbotController.invalidProviderParams(['Base URL']),
      );
    }
    return await this.chatbotService.getLocalLLMAvailableModels(
      baseUrl,
      headers,
    );
  }

  @Get('organization/:oid/provider/:providerId/available')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async getProviderAvailableModels(
    @Param('providerId', ParseIntPipe) providerId: number,
  ): Promise<(OllamaLLMType | OpenAILLMType | LocalLLMType)[]> {
    const provider = await ChatbotProviderModel.findOne({
      where: {
        id: providerId,
      },
    });
    if (!provider) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.chatbotProviderNotFound,
      );
    }

    switch (provider.providerType) {
      case ChatbotServiceProvider.Ollama:
        return await this.chatbotService.getOllamaAvailableModels(
          provider.baseUrl,
          provider.headers,
        );
      case ChatbotServiceProvider.OpenAI:
        return await this.chatbotService.getOpenAIAvailableModels(
          provider.apiKey,
          provider.headers,
        );
      case ChatbotServiceProvider.LocalLLM:
        return await this.chatbotService.getLocalLLMAvailableModels(
          provider.baseUrl,
          provider.headers,
        );
      default:
        throw new BadRequestException(
          ERROR_MESSAGES.chatbotController.invalidProvider,
        );
    }
  }
}

function handleChatbotTokenCheck(user: UserModel) {
  if (!user.chat_token) {
    Sentry.captureMessage('User has no chat token: ' + user.id);
    throw new HttpException('User has no chat token', HttpStatus.FORBIDDEN);
  }
}
