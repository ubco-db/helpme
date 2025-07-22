import {
  AddChatbotQuestionParams,
  AddDocumentAggregateParams,
  AddDocumentChunkParams,
  ChatbotQuestionResponseChatbotDB,
  ChatbotSettings,
  ChatbotSettingsUpdateParams,
  UpdateChatbotQuestionParams,
  UpdateDocumentAggregateParams,
  UpdateDocumentChunkParams,
} from '@koh/common';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
/* This is a list of all endpoints from the chatbot repo.
    We now put chatbot api calls on the backend rather than the frontend so that 
    we can properly guard our endpoints (e.g. to stop students from uploading documents to any course).
    The chatbot repo requires both a user token (holds how many questions they've used)
    and an API key (so that only this helpme repo can call those endpoints).
    Whatever you set CHATBOT_API_KEY to (in your .env file), make sure it matches
    the CHATBOT_API_KEY in the chatbot repo.
*/
export class ChatbotApiService {
  private readonly chatbotApiUrl: string;
  private readonly chatbotApiKey: string;

  constructor(private configService: ConfigService) {
    // this.chatbotApiUrl = this.configService.get<string>('CHATBOT_API_URL');
    this.chatbotApiUrl = 'http://localhost:3003/chat';
    this.chatbotApiKey = this.configService.get<string>('CHATBOT_API_KEY');
  }

  /**
   * Makes an authenticated request to the chatbot service
   * @param method HTTP method
   * @param endpoint Endpoint path (without leading slash)
   * @param data Request body data
   * @param params Query parameters
   * @param userToken user's API token for user-specific endpoints
   * @returns Response from the chatbot service
   */
  private async request(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    userToken: string,
    data?: any,
    params?: any,
  ) {
    try {
      const url = new URL(`${this.chatbotApiUrl}/${endpoint}`);

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HMS-API-KEY': this.chatbotApiKey,
        HMS_API_TOKEN: userToken,
      };

      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new HttpException(
          error.error || 'Error from chatbot service',
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to connect to chatbot service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Chatbot endpoints
  async askQuestion(
    question: string,
    history: any,
    userToken: string,
    courseId: number,
  ) {
    return this.request('POST', `chatbot/${courseId}/ask`, userToken, {
      question,
      history,
    });
  }

  async getModels(userToken: string) {
    return this.request('GET', `chatbot/models`, userToken);
  }

  // Question endpoints

  async addQuestion(
    questionData: AddChatbotQuestionParams,
    courseId: number,
    userToken: string,
  ) {
    return this.request(
      'POST',
      `question/${courseId}`,
      userToken,
      questionData,
    );
  }

  async updateQuestion(
    questionData: UpdateChatbotQuestionParams,
    courseId: number,
    userToken: string,
  ): Promise<ChatbotQuestionResponseChatbotDB> {
    return this.request(
      'PATCH',
      `question/${courseId}/${questionData.id}`,
      userToken,
      questionData,
    );
  }

  async deleteQuestion(id: string, courseId: number, userToken: string) {
    return this.request('DELETE', `question/${courseId}/${id}`, userToken);
  }

  async getSuggestedQuestions(courseId: number, userToken: string) {
    return this.request('GET', `question/${courseId}/suggested`, userToken);
  }

  async getAllQuestions(courseId: number, userToken: string) {
    return this.request('GET', `question/${courseId}/all`, userToken);
  }

  async deleteAllQuestions(courseId: number, userToken: string) {
    // Unused
    return this.request('DELETE', `question/${courseId}/all`, userToken);
  }

  // Chatbot settings endpoints
  async getChatbotSettings(
    courseId: number,
    userToken: string,
  ): Promise<ChatbotSettings> {
    return this.request('GET', `course-setting/${courseId}`, userToken);
  }

  async updateChatbotSettings(
    settings: ChatbotSettingsUpdateParams,
    courseId: number,
    userToken: string,
  ) {
    return this.request(
      'PATCH',
      `course-setting/${courseId}`,
      userToken,
      settings,
    );
  }

  async resetChatbotSettings(courseId: number, userToken: string) {
    return this.request('PATCH', `course-setting/${courseId}/reset`, userToken);
  }

  // Document endpoints

  async getAllDocumentChunks(courseId: number, userToken: string) {
    return this.request('GET', `document/${courseId}`, userToken);
  }

  async getAllAggregateDocuments(courseId: number, userToken: string) {
    return this.request('GET', `document/aggregate/${courseId}`, userToken);
  }

  async addDocumentChunk(
    body: AddDocumentChunkParams,
    courseId: number,
    userToken: string,
  ) {
    return this.request('POST', `document/${courseId}`, userToken, body);
  }

  async updateDocumentChunk(
    docId: string,
    body: UpdateDocumentChunkParams,
    courseId: number,
    userToken: string,
  ) {
    return this.request(
      'PATCH',
      `document/${courseId}/${docId}`,
      userToken,
      body,
    );
  }

  async deleteDocumentChunk(
    docId: string,
    courseId: number,
    userToken: string,
  ) {
    return this.request('DELETE', `document/${courseId}/${docId}`, userToken);
  }

  async deleteDocument(docId: string, courseId: number, userToken: string) {
    return this.request(
      'DELETE',
      `document/aggregate/${courseId}/${docId}`,
      userToken,
    );
  }

  // Creates a document aggregate from raw text - generally only used for LMS documents
  async addDocument(
    courseId: number,
    userToken: string,
    body: AddDocumentAggregateParams,
  ): Promise<{ id: string }> {
    return this.request(
      'POST',
      `document/aggregate/${courseId}`,
      userToken,
      body,
    );
  }

  // Updates a document aggregate with raw text - generally only used for LMS documents
  // Only changes the chunks for the aggregate, no changes to the aggregate itself are made aside from metadata
  async updateDocument(
    docId: string,
    courseId: number,
    userToken: string,
    body: UpdateDocumentAggregateParams,
  ): Promise<{ message: string }> {
    return this.request(
      'PATCH',
      `document/aggregate/${courseId}/${docId}`,
      userToken,
      body,
    );
  }

  async uploadDocument(
    file: Express.Multer.File,
    source: string,
    parseAsPng: boolean,
    courseId: number,
    userToken: string,
  ): Promise<{ docId: string }> {
    try {
      // re-upload the file to the chatbot server while the file is still in memory here
      const formData = new FormData();

      // Add the main file with fieldname "file"
      formData.append(
        'file',
        new Blob([file.buffer], { type: 'application/pdf' }), // it's always going to be pdf
        file.originalname.replace(/\.[^/.]+$/, '.pdf'), // Replace original extension with .pdf
      );

      // Add the JSON data as a separate file with fieldname "source"
      formData.append('source', source);
      formData.append('parseAsPng', String(parseAsPng));

      // Make sure the request method handles FormData correctly
      const url = new URL(`${this.chatbotApiUrl}/document/${courseId}/file`);

      const headers: Record<string, string> = {
        'HMS-API-KEY': this.chatbotApiKey,
        HMS_API_TOKEN: userToken,
      };

      // does not use the this.request function because it doesn't handle FormData correctly
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new HttpException(
          error.error || 'Error from chatbot service',
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to upload document',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async uploadURLDocument(url: string, courseId: number, userToken: string) {
    return this.request('POST', `document/${courseId}/url`, userToken, {
      url,
    });
  }

  // Uploads an LMS file from buffer - specifically for LMS integration file uploads
  async uploadLMSFileFromBuffer(
    file: Express.Multer.File,
    courseId: number,
    userToken: string,
    options: {
      source?: string;
      metadata?: any;
      parseAsPng?: boolean;
    } = {},
  ): Promise<{ docId: string }> {
    try {
      const formData = new FormData();

      formData.append(
        'file',
        new Blob([file.buffer], { type: file.mimetype }),
        file.originalname,
      );

      formData.append('source', options.source || 'LMS Integration');

      if (options.source) {
        formData.append('prefix', options.source);
      }
      if (options.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata));
      }
      formData.append('parseAsPng', String(options.parseAsPng || false));

      const url = new URL(`${this.chatbotApiUrl}/document/${courseId}/file`);

      const headers: Record<string, string> = {
        'HMS-API-KEY': this.chatbotApiKey,
        HMS_API_TOKEN: userToken,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new HttpException(
          error.error || 'Failed to upload LMS file buffer',
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to upload LMS file from buffer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async cloneCourseDocuments(
    courseId: number,
    userToken: string,
    cloneCourseId: number,
    includeDocuments: boolean,
    includeInsertedQuestions: boolean,
    includeInsertedLMSChatbotData: boolean,
    manuallyCreatedChunks: boolean,
    docIdMap?: Record<string, string>,
  ): Promise<{
    message: string;
    newAggregateHelpmePDFIdMap?: Record<string, string>;
  }> {
    return this.request(
      'POST',
      `document/${courseId}/clone/${cloneCourseId}`,
      userToken,
      {
        includeDocuments,
        includeInsertedQuestions,
        includeInsertedLMSChatbotData,
        manuallyCreatedChunks,
        docIdMap,
      },
    );
  }

  async resetCourse(courseId: number, userToken: string) {
    // apparently resets all chatbot data for the course. Unused right now
    return this.request('PATCH', `document/${courseId}/reset`, userToken);
  }
}
