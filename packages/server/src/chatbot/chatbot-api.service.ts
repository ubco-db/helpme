import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClassType } from 'class-transformer/ClassTransformer';
import { plainToClass } from 'class-transformer';
import {
  ChatbotAskBody,
  ChatbotAskResponse,
  ChatbotCourseSettingsResponse,
  ChatbotDocumentAggregateResponse,
  ChatbotDocumentListResponse,
  ChatbotDocumentResponse,
  ChatbotQueryBody,
  ChatbotQueryTypeEnum,
  ChatbotQuestionResponse,
  ChatMessage,
  CloneCourseDocumentsBody,
  CreateChatbotCourseSettingsBody,
  CreateDocumentAggregateBody,
  CreateDocumentChunkBody,
  CreateQuestionBody,
  PaginatedResponse,
  SuggestedQuestionResponse,
  UpdateChatbotCourseSettingsBody,
  UpdateDocumentAggregateBody,
  UpdateDocumentChunkBody,
  UpdateQuestionBody,
  UploadDocumentAggregateBody,
  UploadURLDocumentAggregateBody,
} from '@koh/common';
import { isObject } from '@nestjs/common/utils/shared.utils';

type ChatbotRequestInit<TBody> = {
  userToken?: string;
  data?: TBody;
  params?: Record<string, any>;
  timeoutMs?: number;
};

type PaginationProperties = {
  page?: number;
  pageSize?: number;
  search?: string;
};

type ElementType<T> = T extends (infer E)[] ? E : T;

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
   * @param request Properties for the request
   * @param request.userToken User token to be used to access protected routes
   * @param request.data Data to be passed in the JSON body
   * @param request.params Data to be passed in the query parameters
   * @param request.timeoutMs How long until the request should be considered failed by timeout
   * @param responseClass Class to map the response to
   * @returns Response from the chatbot service
   */
  private async request<TResponse, TBody = void>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    request?: ChatbotRequestInit<TBody>,
    responseClass?: ClassType<ElementType<TResponse>>,
  ): Promise<TResponse>;
  private async request<TResponse, TBody = void>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    request: ChatbotRequestInit<TBody> = {},
    responseClass?: ClassType<TResponse>,
  ): Promise<TResponse> {
    try {
      const { userToken, data, params, timeoutMs } = request;
      const url = new URL(`${this.chatbotApiUrl}/${endpoint}`);

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HMS-API-KEY': this.chatbotApiKey,
      };
      if (userToken) {
        headers['HMS_API_TOKEN'] = userToken;
      }

      let body: BodyInit;
      if (data instanceof FormData) {
        body = data;
      } else if (data != undefined && isObject(data)) {
        body = JSON.stringify(data);
      } else {
        body = data as any;
      }

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined, // abort signal is available as of node 17
      });

      if (!response.ok) {
        const error = await response.json();
        throw new HttpException(
          error.message ?? error.error ?? 'Error from chatbot service',
          response.status,
        );
      }

      if (
        response.headers.has('content-length') &&
        response.headers.get('content-length') === '0'
      ) {
        return;
      }

      const plain = await response.json();
      return responseClass ? plainToClass(responseClass, plain) : plain;
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

  private async getPaginated<TResponse = any, TBody = void>(
    endpoint: string,
    pagination: PaginationProperties,
    request: ChatbotRequestInit<TBody> = {},
    responseClass?: ClassType<TResponse>,
  ): Promise<PaginatedResponse<TResponse>> {
    const { page, pageSize, search } = pagination;

    if (page != undefined && page >= 1) {
      endpoint = `${endpoint}/${page}`;
    }
    const result = await this.request<PaginatedResponse<TResponse>>(
      'GET',
      endpoint,
      {
        ...(request as any),
        params: { ...request.params, pageSize, search },
      },
    );
    result.items = responseClass
      ? plainToClass(responseClass, result.items)
      : result.items;
    return plainToClass(PaginatedResponse<TResponse>, result);
  }

  // Chatbot endpoints
  async askQuestion(
    question: string,
    history: ChatMessage[],
    userToken: string,
    courseId: number,
  ) {
    return this.request(
      'POST',
      `chatbot/${courseId}/ask`,
      {
        userToken,
        data: {
          question,
          history,
        } satisfies ChatbotAskBody,
      },
      ChatbotAskResponse,
    );
  }

  async queryChatbot(params: ChatbotQueryBody): Promise<string> {
    return await this.request<string, ChatbotQueryBody>(
      'POST',
      `chatbot/query`,
      {
        data: params,
        timeoutMs:
          params.type === ChatbotQueryTypeEnum.ABSTRACT ? 5000 : undefined, // 5s timeout for abstract queries
      },
    );
  }

  async getModels(): Promise<Record<string, string>> {
    return this.request<Record<string, string>>('GET', `chatbot/models`);
  }

  // Question endpoints

  async getQuestion(questionId: string): Promise<ChatbotQuestionResponse> {
    return this.request('GET', `question/single/${questionId}`);
  }

  async addQuestion(
    data: CreateQuestionBody,
    courseId: number,
  ): Promise<ChatbotQuestionResponse> {
    return this.request('POST', `question/${courseId}`, {
      data,
    });
  }

  async updateQuestion(
    questionId: string,
    data: UpdateQuestionBody,
    courseId: number,
  ): Promise<ChatbotQuestionResponse> {
    return this.request('PATCH', `question/${courseId}/${questionId}`, {
      data,
    });
  }

  async deleteQuestion(id: string, courseId: number): Promise<void> {
    return this.request('DELETE', `question/${courseId}/${id}`);
  }

  async getSuggestedQuestions(
    courseId: number,
  ): Promise<SuggestedQuestionResponse[]> {
    return this.request('GET', `question/${courseId}/suggested`);
  }

  async getAllQuestions(courseId: number): Promise<ChatbotQuestionResponse[]> {
    return this.request('GET', `question/${courseId}/all`);
  }

  async deleteAllQuestions(courseId: number): Promise<void> {
    // Unused
    return this.request('DELETE', `question/${courseId}/all`);
  }

  // Chatbot settings endpoints
  async getChatbotSettings(
    courseId: number,
  ): Promise<ChatbotCourseSettingsResponse> {
    return this.request(
      'GET',
      `course-setting/${courseId}`,
      undefined,
      ChatbotCourseSettingsResponse,
    );
  }

  async createChatbotSettings(
    settings: CreateChatbotCourseSettingsBody,
    courseId: number,
  ): Promise<ChatbotCourseSettingsResponse> {
    return this.request(
      'POST',
      `course-setting/${courseId}`,
      {
        data: settings,
      },
      ChatbotCourseSettingsResponse,
    );
  }

  async updateChatbotSettings(
    settings: UpdateChatbotCourseSettingsBody,
    courseId: number,
  ): Promise<ChatbotCourseSettingsResponse> {
    return this.request(
      'PATCH',
      `course-setting/${courseId}`,
      {
        data: settings,
      },
      ChatbotCourseSettingsResponse,
    );
  }

  async resetChatbotSettings(
    courseId: number,
  ): Promise<ChatbotCourseSettingsResponse> {
    return this.request('PATCH', `course-setting/${courseId}/reset`);
  }

  async deleteChatbotSettings(courseId: number): Promise<void> {
    return this.request('DELETE', `course-setting/${courseId}`);
  }

  // Document endpoints

  async getDocumentChunk(documentId: string): Promise<ChatbotDocumentResponse> {
    return this.request('GET', `document/single/${documentId}`);
  }

  async getDocumentAggregate(
    documentId: string,
  ): Promise<ChatbotDocumentAggregateResponse> {
    return this.request('GET', `document/single/aggregate/${documentId}`);
  }

  async getAllDocumentChunks(
    courseId: number,
    page?: number,
    pageSize?: number,
    search?: string,
  ): Promise<PaginatedResponse<ChatbotDocumentResponse>> {
    return this.getPaginated(`document/${courseId}`, {
      page,
      pageSize,
      search,
    });
  }

  async getAllAggregateDocuments(
    courseId: number,
    page?: number,
    pageSize?: number,
    search?: string,
  ): Promise<PaginatedResponse<ChatbotDocumentAggregateResponse>> {
    return this.getPaginated(`document/aggregate/${courseId}`, {
      page,
      pageSize,
      search,
    });
  }

  async getListDocuments(
    courseId: number,
    page?: number,
    pageSize?: number,
    search?: string,
  ): Promise<PaginatedResponse<ChatbotDocumentListResponse>> {
    return this.getPaginated(`document/${courseId}/list`, {
      page,
      pageSize,
      search,
    });
  }

  async addDocumentChunk(
    data: CreateDocumentChunkBody,
    courseId: number,
  ): Promise<ChatbotDocumentResponse[]> {
    return this.request<ChatbotDocumentResponse[], CreateDocumentChunkBody>(
      'POST',
      `document/${courseId}`,
      {
        data,
      },
      ChatbotDocumentResponse,
    );
  }

  async updateDocumentChunk(
    docId: string,
    data: UpdateDocumentChunkBody,
    courseId: number,
  ): Promise<ChatbotDocumentResponse[]> {
    return this.request<ChatbotDocumentResponse[], UpdateDocumentChunkBody>(
      'PATCH',
      `document/${courseId}/${docId}`,
      {
        data,
      },
      ChatbotDocumentResponse,
    );
  }

  async deleteDocumentChunk(docId: string, courseId: number): Promise<void> {
    return this.request('DELETE', `document/${courseId}/${docId}`);
  }

  async deleteDocument(docId: string, courseId: number): Promise<void> {
    return this.request('DELETE', `document/aggregate/${courseId}/${docId}`);
  }

  // Creates a document aggregate from raw text - generally only used for LMS documents
  async addDocument(
    courseId: number,
    data: CreateDocumentAggregateBody,
  ): Promise<ChatbotDocumentAggregateResponse> {
    return this.request(
      'POST',
      `document/aggregate/${courseId}`,
      {
        data,
      },
      ChatbotDocumentAggregateResponse,
    );
  }

  // Updates a document aggregate with raw text - generally only used for LMS documents
  // Only changes the chunks for the aggregate, no changes to the aggregate itself are made aside from metadata
  async updateDocument(
    docId: string,
    courseId: number,
    data: UpdateDocumentAggregateBody,
  ): Promise<ChatbotDocumentAggregateResponse> {
    return this.request(
      'PATCH',
      `document/aggregate/${courseId}/${docId}`,
      {
        data,
      },
      ChatbotDocumentAggregateResponse,
    );
  }

  async uploadDocument(
    file: Express.Multer.File,
    params: UploadDocumentAggregateBody,
    courseId: number,
  ): Promise<ChatbotDocumentAggregateResponse> {
    try {
      // re-upload the file to the chatbot server while the file is still in memory here
      const formData = new FormData();
      // Add the main file with fieldname "file"
      formData.append(
        'file',
        new Blob([file.buffer.buffer as ArrayBuffer], {
          type:
            params.lmsDocumentId != undefined
              ? file.mimetype
              : 'application/pdf',
        }), // it's always going to be pdf
        params.lmsDocumentId != undefined
          ? file.originalname
          : file.originalname.replace(/\.[^/.]+$/, '.pdf'), // Replace original extension with .pdf
      );
      // Add the JSON data as a separate file with fieldname "source"
      Object.keys(params).forEach((k) => {
        if (params[k] != undefined) {
          formData.append(k, params[k]);
        }
      });

      return await this.request(
        'POST',
        `document/${courseId}/file`,
        {
          data: formData,
        },
        ChatbotDocumentAggregateResponse,
      );
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

  async uploadURLDocument(
    params: UploadURLDocumentAggregateBody,
    courseId: number,
  ): Promise<ChatbotDocumentAggregateResponse> {
    return this.request(
      'POST',
      `document/${courseId}/url`,
      {
        data: params,
      },
      ChatbotDocumentAggregateResponse,
    );
  }

  async cloneCourseDocuments(
    courseId: number,
    newCourseId: number,
    params: CloneCourseDocumentsBody,
  ): Promise<Record<string, string>> {
    return this.request('POST', `document/${courseId}/clone/${newCourseId}`, {
      data: params,
    });
  }

  async resetCourse(courseId: number): Promise<void> {
    // apparently resets all chatbot data for the course. Unused right now
    return this.request('PATCH', `document/${courseId}/reset`);
  }
}
