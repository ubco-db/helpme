import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import {
  ChatbotAskSuggestedBody,
  ChatbotCourseSettingsResponse,
  ChatbotDocumentAggregateResponse,
  ChatbotDocumentListResponse,
  ChatbotDocumentQueryResponse,
  ChatbotDocumentResponse,
  ChatbotProvider,
  ChatbotQueryBody,
  ChatbotQuestionResponse,
  ChatbotResultEventName,
  ChatbotResultEvents,
  ChatbotServiceProvider,
  ChatbotServiceType,
  CourseChatbotSettings,
  CourseChatbotSettingsForm,
  CreateChatbotProviderBody,
  CreateDocumentChunkBody,
  CreateLLMTypeBody,
  CreateOrganizationChatbotSettingsBody,
  CreateQuestionBody,
  ERROR_MESSAGES,
  GenerateDocumentQueryBody,
  GetAvailableModelsBody,
  HelpMeChatbotAskBody,
  HelpMeChatbotAskResponse,
  HelpMeChatbotQuestionResponse,
  HelpMeChatbotQuestionTableResponse,
  InteractionResponse,
  LLMType,
  OllamaLLMType,
  OpenAILLMType,
  OrganizationChatbotSettings,
  OrganizationChatbotSettingsDefaults,
  OrganizationRole,
  PaginatedResponse,
  Role,
  SuggestedQuestionResponse,
  UpdateChatbotCourseSettingsBody,
  UpdateChatbotProviderBody,
  UpdateDocumentAggregateBody,
  UpdateDocumentChunkBody,
  UpdateLLMTypeBody,
  UpdateQuestionBody,
  UploadDocumentAggregateBody,
  UploadURLDocumentAggregateBody,
  UpsertCourseChatbotSettings,
  UpsertDocumentQueryBody,
} from '@koh/common';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { Roles } from 'decorators/roles.decorator';
import { ChatbotApiService } from './chatbot-api.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserModel } from '../profile/user.entity';
import { User, UserId } from '../decorators/user.decorator';
import * as Sentry from '@sentry/nestjs';
import { CourseRolesBypassHelpMeCourseGuard } from 'guards/course-roles-helpme-bypass.guard';
import { LibreOffice, MarkdownConverter } from 'chromiumly';
import { CourseModel } from 'course/course.entity';
import { generateHTMLForMarkdownToPDF } from './markdown-to-pdf-styles';
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
import { plainToClass } from 'class-transformer';
import { ChatbotResultGateway } from './intermediate-results/chatbot-result.gateway';
import { ClientSocketService } from 'websocket/client-socket.service';

@Controller('chatbot')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@UseInterceptors(IgnoreableClassSerializerInterceptor)
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly chatbotApiService: ChatbotApiService,
    private readonly chatbotResultWebSocket: ChatbotResultGateway,
    private readonly socket: ClientSocketService,
  ) {}

  //
  // Endpoints for both students and staff
  //

  @Post(':courseId/query')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async queryChatbot(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() params: ChatbotQueryBody,
  ): Promise<string> {
    return await this.chatbotApiService.queryChatbot({
      ...params,
      courseId,
    });
  }

  @Post(':courseId/ask')
  @UseGuards(CourseRolesBypassHelpMeCourseGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async askQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body()
    { question, history, interactionId, save }: HelpMeChatbotAskBody,
    @User({ chat_token: true }) user: UserModel,
  ): Promise<HelpMeChatbotAskResponse> {
    handleChatbotTokenCheck(user);

    save ??= true;
    const response = await this.chatbotApiService.askQuestion(
      question,
      history,
      user.chat_token.token,
      courseId,
    );

    if (save) {
      // if there's no interactionId (it's the first question), create a new interaction
      if (!interactionId) {
        const interaction = await this.chatbotService.createInteraction(
          courseId,
          user.id,
        );
        interactionId = interaction.id;
      }
      const question = await this.chatbotService.createQuestion(interactionId, {
        vectorStoreId: response.questionId,
        isPreviousQuestion: response.isPreviousQuestion ?? false,
      });

      return plainToClass(HelpMeChatbotAskResponse, {
        ...response,
        internal: question,
      });
    }

    return plainToClass(HelpMeChatbotAskResponse, response);
  }

  @Post(':courseId/ask/suggested')
  @UseGuards(CourseRolesBypassHelpMeCourseGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async askSuggestedQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() { vectorStoreId }: ChatbotAskSuggestedBody,
    @UserId() userId: number,
  ): Promise<HelpMeChatbotQuestionResponse> {
    const interaction = await this.chatbotService.createInteraction(
      courseId,
      userId,
    );

    return await this.chatbotService.createQuestion(interaction.id, {
      vectorStoreId: vectorStoreId,
      isPreviousQuestion: true,
    });
  }

  @Get(':courseId/question/suggested')
  @UseGuards(CourseRolesBypassHelpMeCourseGuard)
  @Roles(Role.PROFESSOR, Role.TA, Role.STUDENT)
  async getSuggestedQuestions(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<SuggestedQuestionResponse[]> {
    return await this.chatbotApiService.getSuggestedQuestions(courseId);
  }

  @Patch(':courseId/question/:questionId/score')
  @UseGuards(CourseRolesBypassHelpMeCourseGuard)
  @Roles(Role.PROFESSOR, Role.TA, Role.STUDENT)
  async updateChatbotUserScore(
    @Param('questionId') questionId: number, // helpme question id
    @Body() { userScore }: { userScore: number },
  ): Promise<HelpMeChatbotQuestionResponse> {
    return await this.chatbotService.updateQuestionUserScore(
      questionId,
      userScore,
    );
  }

  @Get('history')
  async getChatbotHistory(
    @UserId() userId: number,
  ): Promise<InteractionResponse[]> {
    return await this.chatbotService.getAllInteractionsForUser(userId);
  }

  //
  // Endpoints for Staff-only
  //

  // Settings endpoints
  @Get(':courseId/settings')
  @UseGuards(CourseRolesGuard, ChatbotLegacyEndpointGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getChatbotSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<ChatbotCourseSettingsResponse> {
    return await this.chatbotApiService.getChatbotSettings(courseId);
  }

  @Patch(':courseId/settings')
  @UseGuards(CourseRolesGuard, ChatbotLegacyEndpointGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async updateChatbotSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() settings: UpdateChatbotCourseSettingsBody,
  ): Promise<ChatbotCourseSettingsResponse> {
    return await this.chatbotApiService.updateChatbotSettings(
      settings,
      courseId,
    );
  }

  @Patch(':courseId/settings/reset')
  @UseGuards(CourseRolesGuard, ChatbotLegacyEndpointGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async resetChatbotSettings(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<ChatbotCourseSettingsResponse> {
    return await this.chatbotApiService.resetChatbotSettings(courseId);
  }

  // Question endpoints
  @Get(':courseId/question')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getInteractionsAndQuestions(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<HelpMeChatbotQuestionTableResponse[]> {
    return await this.chatbotService.getCombinedInteractionsAndQuestions(
      courseId,
    );
  }

  @Post(':courseId/question')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async addChatbotQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() questionData: CreateQuestionBody,
  ): Promise<ChatbotQuestionResponse> {
    // NOTE that this endpoint does NOT add the question to the helpme database
    // (since the helpme database only hold questions that were actually asked)
    return await this.chatbotApiService.addQuestion(questionData, courseId);
  }

  @Patch(':courseId/question/:questionId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async updateChatbotQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId') questionId: string,
    @Body() questionData: UpdateQuestionBody,
  ): Promise<ChatbotQuestionResponse> {
    return await this.chatbotApiService.updateQuestion(
      questionId,
      questionData,
      courseId,
    );
  }

  @Delete(':courseId/question/:questionId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async deleteChatbotQuestion(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId') questionId: string,
  ): Promise<void> {
    await this.chatbotService.deleteQuestionByVectorStoreId(
      courseId,
      questionId,
    );
  }

  @Get(':courseId/models')
  @UseGuards(CourseRolesGuard, ChatbotLegacyEndpointGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getModels(): Promise<Record<string, string>> {
    return await this.chatbotApiService.getModels();
  }

  // // Unused
  // @Delete(':courseId/question')
  // @UseGuards(CourseRolesGuard)
  // @Roles(Role.PROFESSOR, Role.TA)
  // async deleteAllQuestions(
  //   @Param('courseId', ParseIntPipe) courseId: number
  // ): Promise<void> {
  //   return await this.chatbotApiService.deleteAllQuestions(courseId);
  // }
  //
  // // resets all chatbot data for the course. Unused
  // @Get(':courseId/reset')
  // @UseGuards(CourseRolesGuard)
  // @Roles(Role.PROFESSOR, Role.TA)
  // async resetCourse(
  //   @Param('courseId', ParseIntPipe) courseId: number
  // ): Promise<void> {
  //   return await this.chatbotApiService.resetCourse(courseId);
  // }

  // Document endpoints
  @Get(':courseId/aggregate{/:page}')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getAllAggregateDocuments(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param(
      'page',
      new DefaultValuePipe(-1),
      new ParseIntPipe({ optional: true }),
    )
    page?: number,
    @Query(
      'pageSize',
      new DefaultValuePipe(-1),
      new ParseIntPipe({ optional: true }),
    )
    pageSize?: number,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<ChatbotDocumentAggregateResponse>> {
    page = page == undefined || page < 1 ? undefined : page;
    pageSize =
      page == undefined || pageSize == undefined || pageSize < 1
        ? undefined
        : pageSize;

    // this gets the full chatbot documents (rather than just the chunks)
    const aggregates = await this.chatbotApiService.getAllAggregateDocuments(
      courseId,
      page,
      pageSize,
      search,
    );

    const ids = aggregates.items.map((v) => v.id);
    const docSizes = await ChatbotDocPdfModel.createQueryBuilder()
      .select('"chatbotId"', 'id')
      .addSelect('pg_size_pretty("docSizeBytes"::bigint)', 'size')
      .where('"chatbotId" IN (:...aggregateIds)', {
        aggregateIds: ids,
      })
      .getRawMany<{ id: string; size: string }>();

    docSizes.forEach(({ id, size }) => {
      const agg = aggregates.items.find((v) => v.id === id);
      agg['size'] = size;
    });

    return aggregates;
  }

  @Get(':courseId/document{/:page}')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getAllDocumentChunks(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param(
      'page',
      new DefaultValuePipe(-1),
      new ParseIntPipe({ optional: true }),
    )
    page?: number,
    @Query(
      'pageSize',
      new DefaultValuePipe(-1),
      new ParseIntPipe({ optional: true }),
    )
    pageSize?: number,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<ChatbotDocumentResponse>> {
    page = page == undefined || page < 1 ? undefined : page;
    pageSize =
      page == undefined || pageSize == undefined || pageSize < 1
        ? undefined
        : pageSize;

    return await this.chatbotApiService.getAllDocumentChunks(
      courseId,
      page,
      pageSize,
      search,
    );
  }

  @Get(':courseId/document/list{/:page}')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getListDocuments(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param(
      'page',
      new DefaultValuePipe(-1),
      new ParseIntPipe({ optional: true }),
    )
    page?: number,
    @Query(
      'pageSize',
      new DefaultValuePipe(-1),
      new ParseIntPipe({ optional: true }),
    )
    pageSize?: number,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<ChatbotDocumentListResponse>> {
    page = page == undefined || page < 1 ? undefined : page;
    pageSize =
      page == undefined || pageSize == undefined || pageSize < 1
        ? undefined
        : pageSize;

    return await this.chatbotApiService.getListDocuments(
      courseId,
      page,
      pageSize,
      search,
    );
  }

  @Post(':courseId/document')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async addDocumentChunk(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: CreateDocumentChunkBody,
  ): Promise<string> {
    return await this.chatbotApiService.addDocumentChunk(body, courseId);
  }

  @Patch(':courseId/document/:docId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async updateDocumentChunk(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('docId') docId: string,
    @Body() body: UpdateDocumentChunkBody,
  ): Promise<string> {
    return await this.chatbotApiService.updateDocumentChunk(
      docId,
      body,
      courseId,
    );
  }

  @Delete(':courseId/document/:docId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async deleteDocumentChunk(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('docId') docId: string,
  ): Promise<void> {
    return await this.chatbotApiService.deleteDocumentChunk(docId, courseId);
  }

  @Patch(':courseId/aggregate/:docId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async updateDocument(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('docId') docId: string,
    @Body() body: UpdateDocumentAggregateBody,
  ): Promise<string> {
    // Delete disallowed update parameters
    delete body.documentText;
    delete body.lmsDocumentId;
    delete body.prefix;

    return await this.chatbotApiService.updateDocument(docId, courseId, body);
  }

  @Delete(':courseId/aggregate/:docId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async deleteDocument(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('docId') docId: string,
  ): Promise<void> {
    await this.chatbotApiService.deleteDocument(docId, courseId);
    // if that succeeded (an error would have been thrown if it didn't), then delete the document from database
    await ChatbotDocPdfModel.delete({
      chatbotId: docId,
    });
  }

  @Get(':courseId/query/:documentId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getDocumentChunkQueries(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('documentId') documentId: string,
  ): Promise<ChatbotDocumentQueryResponse[]> {
    return await this.chatbotApiService.getDocumentChunkQueries(
      documentId,
      courseId,
    );
  }

  @Post(':courseId/query/:documentId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async addDocumentQuery(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('documentId') documentId: string,
    @Body() body: UpsertDocumentQueryBody,
  ): Promise<ChatbotDocumentQueryResponse> {
    return await this.chatbotApiService.addDocumentQuery(
      documentId,
      courseId,
      body,
    );
  }

  @Post(':courseId/query/:documentId/generate')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async generateDocumentQueries(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('documentId') documentId: string,
    @Body() body: GenerateDocumentQueryBody,
  ): Promise<string> {
    return await this.chatbotApiService.generateDocumentQueries(
      documentId,
      courseId,
      body,
    );
  }

  @Patch(':courseId/query/:queryId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async updateDocumentQuery(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('queryId') queryId: string,
    @Body() body: UpsertDocumentQueryBody,
  ): Promise<ChatbotDocumentQueryResponse> {
    return await this.chatbotApiService.updateDocumentQuery(
      queryId,
      courseId,
      body,
    );
  }

  @Delete(':courseId/query/:queryId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async deleteDocumentQuery(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('queryId') queryId: string,
  ): Promise<void> {
    await this.chatbotApiService.deleteDocumentQuery(queryId, courseId);
  }

  @Delete(':courseId/query/:documentId/all')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async deleteAllDocumentQueries(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.chatbotApiService.deleteAllDocumentQueries(documentId, courseId);
  }

  // TODO: eventually add tests for this I guess
  // note that there is no corresponding endpoint for this one on the frontend as you are supposed to make links to it
  @Get('document/:courseId/:docId')
  @UseGuards(CourseRolesBypassHelpMeCourseGuard)
  @IgnoreSerializer()
  @Roles(Role.PROFESSOR, Role.TA, Role.STUDENT)
  async getChatbotDocument(
    @Param('docId') docId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<Response | void> {
    try {
      // First check if document exists and get its metadata
      const docInfo = await ChatbotDocPdfModel.createQueryBuilder('doc')
        .select([
          'doc."docName" as "doc_docName"',
          'LENGTH(doc."docData") as "file_size"',
        ])
        .where('doc."id" = :docId', { docId })
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
        .where('doc."id" = :docId', { docId })
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
  @Post(':courseId/aggregate/file')
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
    @Body() params: Partial<UploadDocumentAggregateBody>,
    @User() user: UserModel,
  ): Promise<string> {
    let { parseAsPng } = params;

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
          ERROR_MESSAGES.chatbotController.textFileTooBig,
        );
      }
    }

    parseAsPng =
      String(parseAsPng) === 'true' || file.mimetype.startsWith('image/');

    // get the course name (for pdf metadata)
    const course = await CourseModel.findOne({
      where: { id: courseId },
    });

    // use Chromiumly to convert all files to pdf (except files that are already pdfs)
    const startTime = Date.now();
    console.log(
      `Starting file conversion for ${file.originalname} (${file.mimetype})`,
    );

    if (fileExtension === 'pdf') {
      // if it's already a pdf, don't convert it (also the converter doesn't work for converting pdfs to pdfs for some reason i guess)
    } else if (
      fileExtension === 'md' ||
      fileExtension === 'txt' ||
      fileExtension === 'csv'
    ) {
      // Generate an HTML template for the markdown conversion
      const htmlTemplate = generateHTMLForMarkdownToPDF({
        title: file.originalname,
        author: `${user.firstName} ${user.lastName}`,
        courseName: course?.name || '',
        isCsv: fileExtension === 'csv',
      });
      // Convert the HTML template string to a Buffer (since that's what .convert wants)
      const htmlBuffer = Buffer.from(htmlTemplate, 'utf-8');

      // NOTE: Gotenberg's markdown converter is outdated and seems to convert markdown to pdf with weird lists and line breaks. TODO: make an issue on their github for this (use userguide and changelog as evidence)
      const markdownConverter = new MarkdownConverter();
      file.buffer = await markdownConverter.convert({
        html: htmlBuffer,
        markdown: file.buffer,
        pdfUA: true,
      });
      // if it's a supported file type for libreoffice conversion, use LibreOfficeConverter
    } else if (
      LibreOfficeSupportedExtensions.includes(fileExtension as FileExtension)
    ) {
      file.buffer = await LibreOffice.convert({
        files: [{ data: file.buffer, ext: fileExtension as FileExtension }],
        // All config options here: https://github.com/cherfia/chromiumly
        pdfUA: true, // enables Universal Access (for improved accessibility)
        metadata: {
          title: file.originalname,
          author: user.firstName + ' ' + user.lastName,
          creator: 'HelpMe Chatbot System', // Identifies the system as the creator of the pdf file (different from the author)
          producer: 'Chromiumly/LibreOffice',
          subject: 'Chatbot Document',
          keywords: 'course material, ' + course.name,
          creationDate: new Date().toISOString(), // Add creation timestamp
        },
        losslessImageCompression: true,
        reduceImageResolution: true,
        maxImageResolution: 150, // apparently 150dpi is good for presentations, with at least 72 being good for web usage
        flatten: true, // flatten the pdf to remove any annotations
      });
    } else {
      // if it's not a supported file type for conversion, throw an error
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Supported types include: .pdf, .docx, .pptx, .xlsx, .txt, .md, .csv, and various image formats.`,
      );
    }

    const endTime = Date.now();
    console.log(
      `${file.originalname} (${file.mimetype}) pdf conversion completed in ${endTime - startTime}ms`,
    );

    let chatbotDocPdf = new ChatbotDocPdfModel();
    chatbotDocPdf.docName = file.originalname;
    chatbotDocPdf.courseId = courseId;
    chatbotDocPdf.docSizeBytes = file.buffer.length;
    chatbotDocPdf = await chatbotDocPdf.save(); // so that we have an id to generate the url
    const docUrl =
      '/api/v1/chatbot/document/' + courseId + '/' + chatbotDocPdf.id;
    chatbotDocPdf.docData = file.buffer;
    // Save file to database and upload to chatbot service in parallel with error handling
    const resultId = await this.chatbotApiService.uploadDocument(
      file,
      {
        source: docUrl,
        parseAsPng,
      },
      courseId,
    );

    const uploadResultId = await this.chatbotResultWebSocket.getUniqueId();

    const subscription = {
      event: ChatbotResultEvents.GET_RESULT,
      args: {
        resultId,
        type: ChatbotResultEventName.ADD_AGGREGATE,
      },
    };

    this.socket
      .expectReply(
        subscription,
        ChatbotResultEvents.POST_RESULT,
        async (result: {
          params: { resultId: string; type: ChatbotResultEventName };
          data: ChatbotDocumentAggregateResponse;
        }) => {
          const { params, data } = result;

          if (
            !params?.resultId ||
            params?.type !== ChatbotResultEventName.ADD_AGGREGATE ||
            (params?.resultId && params?.resultId !== resultId)
          ) {
            return;
          }

          if (data instanceof Error) {
            await this.socket.emitWithAck(ChatbotResultEvents.POST_RESULT, {
              resultId: uploadResultId,
              type: ChatbotResultEventName.ADD_AGGREGATE,
              data,
            });
            return;
          }

          if (chatbotDocPdf) {
            chatbotDocPdf.chatbotId = data.id;
            chatbotDocPdf = await chatbotDocPdf.save();
          }

          const endTime2 = Date.now();
          console.log(
            `${file.originalname} (${file.mimetype}) upload chatbot service and save in db completed in ${endTime2 - endTime}ms for a total processing time of ${endTime2 - startTime}ms`,
          );

          await this.socket.emitWithAck(ChatbotResultEvents.POST_RESULT, {
            resultId: uploadResultId,
            type: ChatbotResultEventName.ADD_AGGREGATE,
            data,
          });
        },
        async (result, err) => {
          if (
            result.data &&
            !(result.data instanceof Error) &&
            'id' in result.data
          ) {
            await this.deleteDocument(courseId, result.data.id);
          }
          if (chatbotDocPdf && chatbotDocPdf.id) {
            await ChatbotDocPdfModel.remove(chatbotDocPdf);
          }
          await this.socket.emitWithAck(ChatbotResultEvents.POST_RESULT, {
            resultId: uploadResultId,
            type: ChatbotResultEventName.ADD_AGGREGATE,
            data: err,
          });
        },
        1000 * 60 * 5, // Allow up to 5 minutes before formally timing out
      )
      .then();

    return uploadResultId;
  }

  @Post(':courseId/aggregate/url')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async addDocumentFromGithub(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() params: UploadURLDocumentAggregateBody,
  ): Promise<string> {
    return await this.chatbotApiService.uploadURLDocument(params, courseId);
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
  ): Promise<void> {
    const original = await OrganizationChatbotSettingsModel.findOne({
      where: { organizationId },
    });
    if (!original) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    }
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
      await this.chatbotApiService.resetChatbotSettings(course.courseId);
      // Update with any modified values
      await this.chatbotApiService.updateChatbotSettings(
        params,
        course.courseId,
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

  @Get('organization/:oid/provider/:providerId/available')
  @UseGuards(OrganizationRolesGuard, OrganizationGuard)
  @Roles(OrganizationRole.ADMIN)
  async getProviderAvailableModels(
    @Param('providerId', ParseIntPipe) providerId: number,
  ): Promise<(OllamaLLMType | OpenAILLMType)[]> {
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
      default:
        throw new BadRequestException(
          ERROR_MESSAGES.chatbotController.invalidProvider,
        );
    }
  }

  // This method allows the chatbot to post asynchronous results back to the HelpMe repository
  // @Post('post/:resultType/:resultId')
  // @UseGuards(ChatbotApiKeyGuard)
  // async postResult(
  //   @Param('resultType', new ParseEnumPipe()) resultType: any,
  //   @Param('resultId', ParseIntPipe) resultId: number,
  // ) {
  //
  // }
}

function handleChatbotTokenCheck(user: UserModel) {
  if (!user.chat_token) {
    Sentry.captureMessage('User has no chat token: ' + user.id);
    throw new HttpException('User has no chat token', HttpStatus.FORBIDDEN);
  }
}

const LibreOfficeSupportedExtensions: FileExtension[] = [
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'csv',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'tiff',
  'svg',
  'pdf',
  'html',
  'rtf',
  'vsd',
  'vsdx',
];

// Type definition for LibreOffice file extensions (this is gathered from the Chromiumly package (it doesn't export it for some reason so i had to copy it here))
type FileExtension =
  | '123' // omg prettier why this used to be 1 line
  | '602'
  | 'abw'
  | 'bib'
  | 'bmp'
  | 'cdr'
  | 'cgm'
  | 'cmx'
  | 'csv'
  | 'cwk'
  | 'dbf'
  | 'dif'
  | 'doc'
  | 'docm'
  | 'docx'
  | 'dot'
  | 'dotm'
  | 'dotx'
  | 'dxf'
  | 'emf'
  | 'eps'
  | 'epub'
  | 'fodg'
  | 'fodp'
  | 'fods'
  | 'fodt'
  | 'fopd'
  | 'gif'
  | 'htm'
  | 'html'
  | 'hwp'
  | 'jpeg'
  | 'jpg'
  | 'key'
  | 'ltx'
  | 'lwp'
  | 'mcw'
  | 'met'
  | 'mml'
  | 'mw'
  | 'numbers'
  | 'odd'
  | 'odg'
  | 'odm'
  | 'odp'
  | 'ods'
  | 'odt'
  | 'otg'
  | 'oth'
  | 'otp'
  | 'ots'
  | 'ott'
  | 'pages'
  | 'pbm'
  | 'pcd'
  | 'pct'
  | 'pcx'
  | 'pdb'
  | 'pdf'
  | 'pgm'
  | 'png'
  | 'pot'
  | 'potm'
  | 'potx'
  | 'ppm'
  | 'pps'
  | 'ppt'
  | 'pptm'
  | 'pptx'
  | 'psd'
  | 'psw'
  | 'pub'
  | 'pwp'
  | 'pxl'
  | 'ras'
  | 'rtf'
  | 'sda'
  | 'sdc'
  | 'sdd'
  | 'sdp'
  | 'sdw'
  | 'sgl'
  | 'slk'
  | 'smf'
  | 'stc'
  | 'std'
  | 'sti'
  | 'stw'
  | 'svg'
  | 'svm'
  | 'swf'
  | 'sxc'
  | 'sxd'
  | 'sxg'
  | 'sxi'
  | 'sxm'
  | 'sxw'
  | 'tga'
  | 'tif'
  | 'tiff'
  | 'txt'
  | 'uof'
  | 'uop'
  | 'uos'
  | 'uot'
  | 'vdx'
  | 'vor'
  | 'vsd'
  | 'vsdm'
  | 'vsdx'
  | 'wb2'
  | 'wk1'
  | 'wks'
  | 'wmf'
  | 'wpd'
  | 'wpg'
  | 'wps'
  | 'xbm'
  | 'xhtml'
  | 'xls'
  | 'xlsb'
  | 'xlsm'
  | 'xlsx'
  | 'xlt'
  | 'xltm'
  | 'xltx'
  | 'xlw'
  | 'xml'
  | 'xpm'
  | 'zabw';
