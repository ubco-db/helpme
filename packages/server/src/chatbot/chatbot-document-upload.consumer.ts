import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, BadRequestException } from '@nestjs/common';
import { Job } from 'bullmq';
import * as Sentry from '@sentry/nestjs';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import {
  AlertDeliveryMode,
  AlertType,
  ChatbotDocumentProcessedPayload,
  ToastType,
} from '@koh/common';
import { ChatbotApiService } from './chatbot-api.service';
import { ChatbotDocPdfModel } from './chatbot-doc-pdf.entity';
import { AlertModel } from '../alerts/alerts.entity';
import { LibreOffice, MarkdownConverter } from 'chromiumly';
import { CourseModel } from 'course/course.entity';
import { generateHTMLForMarkdownToPDF } from './markdown-to-pdf-styles';
import {
  LibreOfficeFileExtension,
  supportedFileExtensionsForLibreOfficeConversion,
  ChatbotService,
  buildChatbotDocumentUploadPipe,
} from './chatbot.service';
import { UserModel } from 'profile/user.entity';

export interface ChatbotDocumentUploadJobData {
  filePath: string;
  originalname: string;
  mimetype: string;
  courseId: number;
  userId: number;
  parseAsPng: boolean;
  uploadId: string;
}

@Processor('chatbot-document-upload')
export class ChatbotDocumentUploadConsumer extends WorkerHost {
  private readonly logger = new Logger(ChatbotDocumentUploadConsumer.name, {
    timestamp: true,
  });

  constructor(
    private readonly chatbotApiService: ChatbotApiService,
    private readonly chatbotService: ChatbotService,
  ) {
    // it's been a while, but I guess since this consumer extends WorkerHost and
    // has its own constructor, it must call super() manually.
    // (normally, if a class extends another class but doesn't have a constructor,
    // the super() call is implicitly added.)
    super();
  }

  async process(job: Job<ChatbotDocumentUploadJobData>): Promise<void> {
    const {
      filePath,
      originalname,
      mimetype,
      courseId,
      userId,
      parseAsPng,
      uploadId,
    } = job.data;
    this.logger.log(
      `Processing chatbot document upload job: ${JSON.stringify(job.data, null, 2)}`,
    );
    let tempFileDeleted = false;

    try {
      // Guard against path traversal — only allow files inside the temp upload directory
      const allowedDir = path.resolve(
        process.env.UPLOAD_LOCATION,
        'temp_chatbot_uploads',
      );
      const resolvedFilePath = path.resolve(filePath);
      if (
        !resolvedFilePath.startsWith(allowedDir + path.sep) &&
        resolvedFilePath !== allowedDir
      ) {
        throw new Error(
          `Refusing to access file outside of temp upload directory: ${resolvedFilePath}`,
        );
      }
      const fileStat = await fs.promises.stat(resolvedFilePath);

      if (fileStat.size > 80 * 1024 * 1024) {
        throw new BadRequestException(
          `File size must be less than 80MB. It must've grown sometime after it was uploaded and before it was processed. This shouldn't happen.`,
        );
      }

      // Read file from disk into buffer
      const fileBuffer = await fs.promises.readFile(resolvedFilePath);
      const fileExtension = originalname.split('.').pop()?.toLowerCase();

      // if the file is a text file (including markdown and csv), don't allow sizes over 2 MB (since 4MB of text is actually a lot)
      if (
        fileExtension === 'txt' ||
        fileExtension === 'csv' ||
        fileExtension === 'md'
      ) {
        if (fileBuffer.length > 1024 * 2048) {
          throw new BadRequestException(
            'Text-only files (.txt, .csv, .md) must be less than 2MB (2MB of text is a lot)',
          );
        }
      }

      // Build a file-like object matching Express.Multer.File shape for the API service
      const file: Express.Multer.File = {
        buffer: fileBuffer,
        originalname,
        mimetype,
        size: fileBuffer.length,
        fieldname: 'file',
        encoding: '7bit',
        stream: Readable.from(fileBuffer),
        destination: '',
        filename: '',
        path: '',
      };

      // Validate the file using NestJS ParseFilePipe (magic number & size validation)
      const pipe = buildChatbotDocumentUploadPipe();
      await pipe.transform(file);

      // get the course name (for pdf metadata)
      const course = await CourseModel.findOne({
        where: { id: courseId },
      });
      if (!course) {
        throw new Error(
          `Course not found for id: ${courseId} for job ${JSON.stringify(job.data)}. Perhaps the course was deleted while processing an uploaded chatbot document.`,
        );
      }
      const user = await UserModel.findOne({
        where: { id: userId },
        relations: { chat_token: true },
      });
      if (!user) {
        throw new Error(
          `User not found for id: ${userId} for job ${JSON.stringify(job.data)}`,
        );
      }
      if (!user.chat_token) {
        throw new Error(
          `Chat token not found for user id: ${userId} for job ${JSON.stringify(job.data)}`,
        );
      }
      const chatToken = user.chat_token.token;

      // use Chromiumly to convert all files to pdf (except files that are already pdfs)
      const startTime = Date.now();
      this.logger.log(
        `Starting file conversion for ${originalname} (${mimetype})`,
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
          title: originalname,
          author: `${user.name}`,
          courseName: course.name,
          isCsv: fileExtension === 'csv',
        });
        // Convert the HTML template string to a Buffer (since that's what .convert wants)
        const htmlBuffer = Buffer.from(htmlTemplate, 'utf-8');

        // TODO: NOTE: Gotenberg's markdown converter is outdated and seems to convert markdown to pdf with weird lists and line breaks. TODO: make an issue on their github for this (use userguide and changelog as evidence)
        // This is why we use chromiumly instead.
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
          fileExtension as LibreOfficeFileExtension,
        )
      ) {
        const buffer = await LibreOffice.convert({
          files: [
            {
              data: file.buffer,
              ext: fileExtension as LibreOfficeFileExtension,
            },
          ],
          // All config options here: https://github.com/cherfia/chromiumly
          pdfUA: true, // enables Universal Access (for improved accessibility)
          metadata: {
            title: originalname,
            author: user.name,
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
        // This shouldn't happen since we validate in the controller where the job is created, but just in case
        throw new Error(
          `Unsupported file type in consumer for ${originalname} (${mimetype}). Supported types include: .pdf, .docx, .pptx, .xlsx, .txt, .md, .csv, and various image formats.`,
        );
      }

      const endTime = Date.now();
      this.logger.log(
        `${originalname} (${mimetype}) pdf conversion completed in ${endTime - startTime}ms`,
      );

      let chatbotDocPdf = new ChatbotDocPdfModel();
      chatbotDocPdf.docName = originalname;
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
          parseAsPng,
          courseId,
          chatToken,
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
          chatToken,
        );
        throw savedDocPdf.reason;
      } else if (
        savedDocPdf.status === 'rejected' &&
        uploadResult.status === 'rejected'
      ) {
        // Both failed, throw combined error
        throw new Error(
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
        this.logger.log(
          `${originalname} (${mimetype}) upload chatbot service and save in db completed in ${endTime2 - endTime}ms for a total processing time of ${endTime2 - startTime}ms`,
        );
      } else {
        throw new Error(
          "Unexpected error. Somehow both the upload and save didn't fulfill nor reject",
        );
      }

      // Delete temp file from disk
      await this.deleteTempFile(filePath);
      tempFileDeleted = true;

      // Create success TOAST alert for the user
      await AlertModel.create({
        alertType: AlertType.CHATBOT_DOCUMENT_PROCESSED,
        deliveryMode: AlertDeliveryMode.TOAST,
        userId,
        courseId,
        payload: {
          toastType: ToastType.SUCCESS,
          title: 'Chatbot Document Processed',
          description: `"${originalname}" has been successfully uploaded and processed.`,
          documentId: chatbotDocPdf.idHelpMeDB,
          documentName: originalname,
          uploadId: uploadId || '',
        } satisfies ChatbotDocumentProcessedPayload,
      }).save();
    } catch (error) {
      this.logger.error(
        `Failed to process document upload job ${job.id}: ${JSON.stringify(error)}`,
        error.stack,
      );
      Sentry.captureException(error, {
        extra: {
          jobId: job.id,
          originalname,
          courseId,
          userId,
        },
      });

      // Clean up temp file if not already deleted
      if (!tempFileDeleted) {
        await this.deleteTempFile(filePath);
      }

      // Create error TOAST alert for the user
      try {
        await AlertModel.create({
          alertType: AlertType.CHATBOT_DOCUMENT_PROCESSED,
          deliveryMode: AlertDeliveryMode.TOAST,
          userId,
          courseId,
          payload: {
            toastType: ToastType.ERROR,
            title: 'Chatbot Document Upload Failed',
            description:
              `Failed to process "${originalname}". Error message:` +
              error.message,
            documentId: 0,
            documentName: originalname,
            uploadId: uploadId || '',
          } satisfies ChatbotDocumentProcessedPayload,
        }).save();
      } catch (alertError) {
        // need to catch this one separately otherwise the original exception won't propagate
        // (If you look above, this whole block of code is within a catch block)
        this.logger.error(
          `Failed to create error alert for user ${userId}: ${alertError.message}`,
        );
        Sentry.captureException(alertError);
      }

      throw error; // Re-throw so BullMQ marks the job as failed
    }
  }

  private async deleteTempFile(filePath: string): Promise<void> {
    try {
      const allowedDir = path.resolve(
        process.env.UPLOAD_LOCATION,
        'temp_chatbot_uploads',
      );
      const resolvedPath = path.resolve(filePath);
      if (
        !resolvedPath.startsWith(allowedDir + path.sep) &&
        resolvedPath !== allowedDir
      ) {
        this.logger.warn(
          `Refusing to delete file outside temp upload dir: ${resolvedPath}`,
        );
        return;
      }
      if (fs.existsSync(resolvedPath)) {
        await fs.promises.unlink(resolvedPath);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to delete temp file ${filePath}: ${err.message}`,
      );
    }
  }
}
