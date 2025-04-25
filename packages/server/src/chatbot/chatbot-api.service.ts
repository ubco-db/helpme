import {
  AddChatbotQuestionParams,
  ChatbotSettingsMetadata,
  UpdateDocumentChunkParams,
  AddDocumentChunkParams,
  ChatbotQuestionResponseChatbotDB,
  UpdateChatbotQuestionParams,
} from '@koh/common';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
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
    courseId: number,
    userToken: string,
    data?: any,
    params?: any,
  ) {
    try {
      const url = new URL(`${this.chatbotApiUrl}/${courseId}/${endpoint}`);
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

  // Question endpoints
  async askQuestion(
    question: string,
    history: any,
    userToken: string,
    courseId: number,
  ) {
    return this.request('POST', 'ask', courseId, userToken, {
      question,
      history,
    });
  }

  async getAllQuestions(courseId: number, userToken: string) {
    return this.request('GET', 'allQuestions', courseId, userToken);
  }

  async getSuggestedQuestions(courseId: number, userToken: string) {
    return this.request('GET', 'allSuggestedQuestions', courseId, userToken);
  }

  async addQuestion(
    questionData: AddChatbotQuestionParams,
    courseId: number,
    userToken: string,
  ) {
    return this.request('POST', 'question', courseId, userToken, questionData);
  }

  async updateQuestion(
    questionData: UpdateChatbotQuestionParams,
    courseId: number,
    userToken: string,
  ): Promise<ChatbotQuestionResponseChatbotDB> {
    return this.request('PATCH', `question`, courseId, userToken, questionData);
  }

  async deleteQuestion(id: string, courseId: number, userToken: string) {
    return this.request('DELETE', `question/${id}`, courseId, userToken);
  }

  async deleteAllQuestions(courseId: number, userToken: string) {
    // Unused
    return this.request('DELETE', 'deleteAllQuestions', courseId, userToken);
  }

  // Chatbot settings endpoints
  async getChatbotSettings(courseId: number, userToken: string) {
    return this.request('GET', 'oneChatbotSetting', courseId, userToken);
  }

  async updateChatbotSettings(
    settings: ChatbotSettingsMetadata,
    courseId: number,
    userToken: string,
  ) {
    return this.request(
      'PATCH',
      'updateChatbotSetting',
      courseId,
      userToken,
      settings,
    );
  }

  async resetChatbotSettings(courseId: number, userToken: string) {
    return this.request('PATCH', 'resetChatbotSetting', courseId, userToken);
  }

  async resetCourse(courseId: number, userToken: string) {
    // apparently resets all chatbot data for the course. Unused right now
    return this.request('GET', 'resetCourse', courseId, userToken);
  }

  // Document endpoints
  async getAllAggregateDocuments(courseId: number, userToken: string) {
    return this.request('GET', 'aggregateDocuments', courseId, userToken);
  }

  async getAllDocumentChunks(courseId: number, userToken: string) {
    return this.request('GET', 'allDocumentChunks', courseId, userToken);
  }

  async addDocumentChunk(
    body: AddDocumentChunkParams,
    courseId: number,
    userToken: string,
  ) {
    return this.request('POST', 'documentChunk', courseId, userToken, body);
  }

  async updateDocumentChunk(
    docId: string,
    body: UpdateDocumentChunkParams,
    courseId: number,
    userToken: string,
  ) {
    return this.request(
      'PATCH',
      `${docId}/documentChunk`,
      courseId,
      userToken,
      body,
    );
  }

  async deleteDocumentChunk(
    docId: string,
    courseId: number,
    userToken: string,
  ) {
    return this.request(
      'DELETE',
      `documentChunk/${docId}`,
      courseId,
      userToken,
    );
  }

  async deleteDocument(docId: string, courseId: number, userToken: string) {
    return this.request('DELETE', `${docId}/document`, courseId, userToken);
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

      // Create JSON data for source and parseAsPng
      const jsonData = JSON.stringify({
        source: source,
        parseAsPng: parseAsPng,
      });

      // Add the JSON data as a separate file with fieldname "source" (will be saved as "blob")
      formData.append(
        'source',
        new Blob([jsonData], { type: 'application/json' }),
      );

      // Make sure the request method handles FormData correctly
      const url = new URL(`${this.chatbotApiUrl}/${courseId}/document`);

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

  async addDocumentFromGithub(
    url: string,
    courseId: number,
    userToken: string,
  ) {
    return this.request('POST', 'document/url/github', courseId, userToken, {
      url,
    });
  }
}
