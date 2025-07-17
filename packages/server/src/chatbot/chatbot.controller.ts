import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
  AddChatbotQuestionParams,
  AddDocumentChunkParams,
  ChatbotAskParams,
  ChatbotAskResponse,
  ChatbotAskSuggestedParams,
  ChatbotQuestionResponseChatbotDB,
  ChatbotQuestionResponseHelpMeDB,
  ChatbotSettings,
  ChatbotSettingsUpdateParams,
  GetChatbotHistoryResponse,
  GetInteractionsAndQuestionsResponse,
  InteractionResponse,
  Role,
  UpdateChatbotQuestionParams,
  UpdateDocumentChunkParams,
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
  @UseGuards(CourseRolesBypassHelpMeCourseGuard)
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
  @UseGuards(CourseRolesBypassHelpMeCourseGuard)
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
  @UseGuards(CourseRolesBypassHelpMeCourseGuard)
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

  @Patch('questionScore/:courseId/:questionId')
  @UseGuards(CourseRolesBypassHelpMeCourseGuard)
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
  @UseGuards(CourseRolesGuard)
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
  @UseGuards(CourseRolesGuard)
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
  @UseGuards(CourseRolesGuard)
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
  @UseGuards(CourseRolesGuard)
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
  @UseGuards(CourseRolesBypassHelpMeCourseGuard)
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
        return res.status(HttpStatus.NOT_FOUND).send('Document not found');
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
      limits: {
        fileSize: 1024 * 1024 * 80, // 80MB
      },
    }),
  )
  async uploadDocument(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    {
      parseAsPng,
      semanticSplit,
    }: { parseAsPng: boolean | string; semanticSplit: boolean | string },
    @User({ chat_token: true }) user: UserModel,
  ) {
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

    parseAsPng = parseAsPng == 'true';
    semanticSplit = semanticSplit == 'true';

    // if it's an image, make parseAsPng true
    if (file.mimetype.startsWith('image/')) {
      parseAsPng = true;
    }

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
      const buffer = await markdownConverter.convert({
        html: htmlBuffer,
        markdown: file.buffer,
        pdfUA: true,
      });
      file.buffer = buffer;
      // if it's a supported file type for libreoffice conversion, use LibreOfficeConverter
    } else if (
      supportedFileExtensionsForLibreOfficeConversion.includes(
        fileExtension as FileExtension,
      )
    ) {
      const buffer = await LibreOffice.convert({
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
      file.buffer = buffer;
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
    chatbotDocPdf = await chatbotDocPdf.save(); // so that we have an idHelpMeDB to generate the url
    const docUrl =
      '/api/v1/chatbot/document/' + courseId + '/' + chatbotDocPdf.idHelpMeDB;
    chatbotDocPdf.docData = file.buffer;
    // Save file to database and upload to chatbot service in parallel with error handling
    const [savedDocPdf, uploadResult] = await Promise.allSettled([
      chatbotDocPdf.save(),
      this.chatbotApiService.uploadDocument(
        file,
        docUrl,
        courseId,
        user.chat_token.token,
        parseAsPng,
        semanticSplit,
      ),
    ]);

    // Check if either promise rejected
    if (
      savedDocPdf.status === 'fulfilled' &&
      uploadResult.status === 'rejected'
    ) {
      // If DB save succeeded but upload failed, clean up the DB entry
      await ChatbotDocPdfModel.remove(savedDocPdf.value);
      throw uploadResult.reason;
    } else if (
      savedDocPdf.status === 'rejected' &&
      uploadResult.status === 'fulfilled'
    ) {
      // If upload succeeded but DB save failed, clean up the uploaded document
      await this.chatbotApiService.deleteDocument(
        uploadResult.value.docId,
        courseId,
        user.chat_token.token,
      );
      throw savedDocPdf.reason;
    } else if (
      savedDocPdf.status === 'rejected' &&
      uploadResult.status === 'rejected'
    ) {
      // Both failed, throw combined error (i'm doing a 500 level error since that's usually what would happen if both fail)
      throw new InternalServerErrorException(
        `Failed to save document: ${savedDocPdf.reason}.\n Failed to upload: ${uploadResult.reason}`,
      );
    } else if (
      savedDocPdf.status === 'fulfilled' &&
      uploadResult.status === 'fulfilled'
    ) {
      // if both succeed, then save the docId to the database
      chatbotDocPdf.docIdChatbotDB = uploadResult.value.docId;
      await chatbotDocPdf.save();

      const endTime2 = Date.now();
      console.log(
        `${file.originalname} (${file.mimetype}) upload chatbot service and save in db completed in ${endTime2 - endTime}ms for a total processing time of ${endTime2 - startTime}ms`,
      );
      return uploadResult.value;
    } else {
      throw new InternalServerErrorException(
        "Unexpected error. Somehow both the upload and save didn't fulfill nor reject",
      );
    }
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
}

function handleChatbotTokenCheck(user: UserModel) {
  if (!user.chat_token) {
    Sentry.captureMessage('User has no chat token: ' + user.id);
    throw new HttpException('User has no chat token', HttpStatus.FORBIDDEN);
  }
}

const supportedFileExtensionsForLibreOfficeConversion: FileExtension[] = [
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
