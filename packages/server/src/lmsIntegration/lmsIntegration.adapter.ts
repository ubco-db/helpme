import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  ERROR_MESSAGES,
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSCourseAPIResponse,
  LMSFile,
  LMSIntegrationPlatform,
  LMSPage,
  LMSPostAuthBody,
  LMSPostResponseBody,
  LMSQuiz,
} from '@koh/common';
import { LMSUpload } from './lmsIntegration.service';
import { Cache } from 'cache-manager';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { LMSAuthStateModel } from './lms-auth-state.entity';
import { ConfigService } from '@nestjs/config';
import express from 'express';
import { LMSAccessToken, LMSAccessTokenModel } from './lms-access-token.entity';
import { OrganizationSettingsModel } from '../organization/organization_settings.entity';
import * as crypto from 'crypto';

@Injectable()
export class LMSIntegrationAdapter {
  async getAdapter(
    integration: LMSCourseIntegrationModel,
    cacheManager?: Cache,
  ) {
    switch (integration.orgIntegration.apiPlatform) {
      case 'Canvas':
        return new CanvasLMSAdapter(integration, cacheManager);
    }
    return new BaseLMSAdapter(integration, cacheManager);
  }
}

export abstract class AbstractLMSAdapter {
  protected refreshTokenUrl: string;

  /* eslint-disable @typescript-eslint/no-unused-vars */
  constructor(
    protected integration: LMSCourseIntegrationModel,
    protected cacheManager?: Cache,
  ) {}

  static async createState(
    organizationIntegration: LMSOrganizationIntegrationModel,
    userId: number,
    redirectUrl?: string,
  ): Promise<LMSAuthStateModel> {
    let state: string;
    do {
      state = encodeURIComponent(crypto.randomBytes(25).toString('hex'));
    } while (await LMSAuthStateModel.findOne({ where: { state } }));

    return await LMSAuthStateModel.save({
      state,
      organizationIntegration,
      userId,
      redirectUrl,
    });
  }

  static async logoutAuth(accessToken: LMSAccessTokenModel): Promise<boolean> {
    const adapter = new LMSIntegrationAdapter();
    const lmsAdapter = await adapter.getAdapter({
      accessTokenId: accessToken.id,
      accessToken: accessToken,
      orgIntegration: accessToken.organizationIntegration,
    } as unknown as LMSCourseIntegrationModel);

    return await lmsAdapter.logoutAuth();
  }

  async logoutAuth(): Promise<boolean> {
    return null;
  }

  static async redirectAuth(
    response: express.Response,
    organizationIntegration: LMSOrganizationIntegrationModel,
    userId: number,
    configService: ConfigService,
    redirectUrl?: string,
  ): Promise<any> {
    switch (organizationIntegration.apiPlatform) {
      case 'Canvas':
        return CanvasLMSAdapter.redirectAuth(
          response,
          organizationIntegration,
          userId,
          configService,
          redirectUrl,
        );
    }
    return null;
  }

  static async postAuth(
    authBody: LMSPostAuthBody,
    organizationIntegration: LMSOrganizationIntegrationModel,
  ) {
    switch (organizationIntegration.apiPlatform) {
      case 'Canvas':
        return CanvasLMSAdapter.postAuth(authBody, organizationIntegration);
    }
    return null;
  }

  static async getUserCourses(accessToken: LMSAccessTokenModel): Promise<{
    status: LMSApiResponseStatus;
    courses: LMSCourseAPIResponse[];
  }> {
    const adapter = new LMSIntegrationAdapter();
    const lmsAdapter = await adapter.getAdapter({
      accessTokenId: accessToken.id,
      accessToken: accessToken,
      orgIntegration: accessToken.organizationIntegration,
    } as unknown as LMSCourseIntegrationModel);

    return await lmsAdapter.getUserCourses();
  }

  async checkAccessToken(id: number): Promise<{
    accessToken: LMSAccessTokenModel;
    token: LMSAccessToken;
  }> {
    const accessToken = await LMSAccessTokenModel.findOne({
      where: {
        id: id,
      },
      relations: {
        organizationIntegration: true,
      },
    });
    if (!accessToken) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsAdapter.missingAccessToken,
      );
    }

    const token = await accessToken.getToken();

    if (accessToken.isExpired(token)) {
      const response = await fetch(this.refreshTokenUrl, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: accessToken.organizationIntegration.clientId,
          client_secret: accessToken.organizationIntegration.clientSecret,
          refresh_token: token.refresh_token,
        } as unknown as Record<string, string>).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new HttpException(
          `${err.error}: ${err.error_description}`,
          response.status,
        );
      }

      const raw = (await response.json()) as LMSPostResponseBody;
      const updated = await accessToken.encryptToken(raw);

      return {
        accessToken: updated,
        token: await updated.getToken(),
      };
    }

    return {
      accessToken,
      token,
    };
  }

  async getAuthorization() {
    const orgSettings = await OrganizationSettingsModel.findOne({
      where: {
        organizationId: this.integration.orgIntegration.organizationId,
      },
    });
    if (this.integration.apiKey != undefined && orgSettings?.allowLMSApiKey) {
      if (
        this.integration.apiKeyExpiry &&
        this.integration.apiKeyExpiry.getTime() < Date.now()
      ) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.apiKeyExpired,
        );
      }
      return `Bearer ${this.integration.apiKey}`;
    }

    if (!this.integration.accessTokenId) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsAdapter.missingAccessToken,
      );
    }

    const { token } = await this.checkAccessToken(
      this.integration.accessTokenId,
    );
    return `${token.token_type} ${token.access_token}`;
  }

  getPlatform(): LMSIntegrationPlatform | null {
    return null;
  }

  isImplemented(): boolean {
    return false;
  }

  async Get(
    url: string,
  ): Promise<{ status: LMSApiResponseStatus; data?: any; nextLink?: string }> {
    return null;
  }

  async getUserCourses(): Promise<{
    status: LMSApiResponseStatus;
    courses: LMSCourseAPIResponse[];
  }> {
    return null;
  }

  async getCourse(): Promise<{
    status: LMSApiResponseStatus;
    course: LMSCourseAPIResponse;
  }> {
    return null;
  }

  async getStudents(): Promise<{
    status: LMSApiResponseStatus;
    students: string[];
  }> {
    return null;
  }

  async getAnnouncements(): Promise<{
    status: LMSApiResponseStatus;
    announcements: LMSAnnouncement[];
  }> {
    return null;
  }

  async getAssignments(): Promise<{
    status: LMSApiResponseStatus;
    assignments: LMSAssignment[];
  }> {
    return null;
  }

  async getPages(): Promise<{
    status: LMSApiResponseStatus;
    pages: LMSPage[];
  }> {
    return null;
  }

  async getFiles(): Promise<{
    status: LMSApiResponseStatus;
    files: LMSFile[];
  }> {
    return null;
  }

  async getQuizzes(): Promise<{
    status: LMSApiResponseStatus;
    quizzes: LMSQuiz[];
  }> {
    return null;
  }

  getDocumentLink(documentId: number, documentType: LMSUpload): string {
    switch (documentType) {
      default:
        return '';
    }
  }
}

abstract class ImplementedLMSAdapter extends AbstractLMSAdapter {
  isImplemented(): boolean {
    return true;
  }
}

export class BaseLMSAdapter extends AbstractLMSAdapter {}

class CanvasLMSAdapter extends ImplementedLMSAdapter {
  constructor(
    protected integration: LMSCourseIntegrationModel,
    protected cacheManager?: Cache,
  ) {
    super(integration, cacheManager);
    this.refreshTokenUrl = `${this.integration.orgIntegration.secure ? 'https' : 'http'}://${this.integration.orgIntegration.rootUrl}/login/oauth2/token`;
  }

  getPlatform(): LMSIntegrationPlatform {
    return LMSIntegrationPlatform.Canvas;
  }

  async logoutAuth(): Promise<boolean> {
    const uri = `${this.integration.orgIntegration.secure ? 'https' : 'http'}://${this.integration.orgIntegration.rootUrl}/login/oauth2/token`;

    let alreadyInvalid = false;
    await this.checkAccessToken(this.integration.accessTokenId).catch((err) => {
      if ((err as Error).message == `invalid_grant: refresh_token not found`) {
        alreadyInvalid = true;
      }
    });
    if (alreadyInvalid) return true;

    return await fetch(uri, {
      method: 'DELETE',
      headers: {
        Authorization: await this.getAuthorization(),
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status != 500) {
            const json = await res.json();
            throw new HttpException(`${json.error}`, res.status);
          } else {
            throw new HttpException('Fetch failed', 500);
          }
        }
        console.log('Successfully invalidated token!');
        return true;
      })
      .catch((err) => {
        console.error(
          `Could not invalidate token. Error: ${(err as Error).message}`,
        );
        return false;
      });
  }

  static async redirectAuth(
    response: express.Response,
    organizationIntegration: LMSOrganizationIntegrationModel,
    userId: number,
    configService: ConfigService,
    redirectUrl?: string,
  ) {
    const uri = `https://${organizationIntegration.rootUrl}/login/oauth2/auth`;

    const state = await super.createState(
      organizationIntegration,
      userId,
      redirectUrl,
    );

    const query = new URLSearchParams({
      client_id: organizationIntegration.clientId,
      response_type: 'code',
      state: state.state,
      scope: [
        'url:GET|/api/v1/users/:user_id/courses',
        'url:GET|/api/v1/courses/:id',
        'url:GET|/api/v1/courses/:course_id/assignments',
        'url:GET|/api/v1/courses/:course_id/users',
        'url:GET|/api/v1/courses/:course_id/enrollments',
        'url:GET|/api/v1/courses/:course_id/discussion_topics',
        'url:GET|/api/v1/courses/:course_id/pages',
        'url:GET|/api/v1/courses/:course_id/pages/:url_or_id',
        'url:GET|/api/v1/courses/:course_id/files',
        'url:GET|/api/v1/courses/:course_id/quizzes',
        'url:GET|/api/v1/courses/:course_id/quizzes/:quiz_id/questions',
      ].join(' '),
      redirect_uri: `${configService.get<string>('DOMAIN')}/api/v1/lms/oauth2/response`,
    });

    const url = `${uri}?${query.toString()}`;
    return response.redirect(url);
  }

  static async postAuth(
    authBody: LMSPostAuthBody,
    organizationIntegration: LMSOrganizationIntegrationModel,
  ) {
    const uri = `${organizationIntegration.secure ? 'https' : 'http'}://${organizationIntegration.rootUrl}/login/oauth2/token`;

    return await fetch(uri, {
      method: 'POST',
      body: new URLSearchParams(
        authBody as unknown as Record<string, string>,
      ).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
      .then(async (res) => {
        if (res.ok) return res;
        else {
          throw await res.json().then((json) => {
            return new HttpException(
              `${json.error}: ${json.error_description}`,
              res.status,
            );
          });
        }
      })
      .catch((err) => {
        throw err;
      });
  }

  async Get(
    path: string,
  ): Promise<{ status: LMSApiResponseStatus; data?: any; nextLink?: string }> {
    const url = `${this.integration.orgIntegration.secure ? 'https' : 'http'}://${this.integration.orgIntegration.rootUrl}/api/v1/${path}`;
    const cacheKey = url;

    // Check cache first
    if (this.cacheManager) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as {
          status: LMSApiResponseStatus;
          data?: any;
          nextLink?: string;
        };
      }
    }

    // Make the actual API call
    const result = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: await this.getAuthorization(),
      },
    })
      .then((response) => {
        let nextLink: string | undefined = undefined;
        const linkHeader = response.headers.get('link');
        if (linkHeader) {
          const links = linkHeader.split(/(?<=rel="[^"]*")/);
          nextLink = links.find((s) => s.includes('rel="next"'));
          if (nextLink != undefined) {
            nextLink = nextLink.substring(
              nextLink.indexOf('/api/v1/') + '/api/v1/'.length,
              nextLink.indexOf('>'),
            );
          }
        }
        if (!response.ok) {
          switch (response.status) {
            case 401:
            case 403:
              return { status: LMSApiResponseStatus.InvalidKey };
            case 404:
              return { status: LMSApiResponseStatus.InvalidCourseId };
            default:
              throw new Error();
          }
        } else {
          return response.json().then((data) => {
            return { status: LMSApiResponseStatus.Success, data, nextLink };
          });
        }
      })
      .catch((error) => {
        console.log(
          `Error contacting ${this.integration.orgIntegration.rootUrl}: ${error}`,
        );
        return { status: LMSApiResponseStatus.Error };
      });

    // Cache successful results for 5 minutes
    if (this.cacheManager && result.status === LMSApiResponseStatus.Success) {
      await this.cacheManager.set(cacheKey, result, 300000);
    }

    return result;
  }

  async GetPaginated(
    initialPath: string,
  ): Promise<{ status: LMSApiResponseStatus; data?: any }> {
    let data: any[] = [];
    let nextLink =
      initialPath.indexOf('?') != -1
        ? `${initialPath}&per_page=50`
        : `${initialPath}?per_page=50`;

    while (nextLink !== undefined) {
      const res = await this.Get(nextLink);
      if (res.status != LMSApiResponseStatus.Success)
        return { status: res.status, data: [] };

      data = [...data, ...res.data];
      nextLink = res.nextLink;
    }
    return { status: LMSApiResponseStatus.Success, data };
  }

  async getUserCourses(): Promise<{
    status: LMSApiResponseStatus;
    courses: LMSCourseAPIResponse[];
  }> {
    const token = await this.integration.accessToken.getToken();

    const { status, data } = await this.GetPaginated(
      `users/${token.userId}/courses`,
    );
    if (status != LMSApiResponseStatus.Success) return { status, courses: [] };

    return {
      status: LMSApiResponseStatus.Success,
      courses: data.map((course: any) => ({
        id: course.id,
        name: course.name,
        code: course.course_code,
        studentCount: 0,
      })),
    };
  }

  async getCourse(): Promise<{
    status: LMSApiResponseStatus;
    course: LMSCourseAPIResponse;
  }> {
    const { status, data } = await this.Get(
      `courses/${this.integration.apiCourseId}?include[]=total_students`,
    );
    if (status != LMSApiResponseStatus.Success)
      return { status, course: {} as any };

    return {
      status: LMSApiResponseStatus.Success,
      course: {
        id: data.id,
        name: data.name,
        code: data.course_code,
        studentCount: data.total_students,
      } satisfies LMSCourseAPIResponse,
    };
  }

  async getStudents(): Promise<{
    status: LMSApiResponseStatus;
    students: string[];
  }> {
    const { status, data } = await this.GetPaginated(
      `courses/${this.integration.apiCourseId}/enrollments?type[]=StudentEnrollment&state[]=active`,
    );

    if (status != LMSApiResponseStatus.Success) return { status, students: [] };

    return {
      status: LMSApiResponseStatus.Success,
      students: data
        .filter((student: any) => student.user != undefined)
        .map((student: any) => student.user.name),
    };
  }

  async getAnnouncements(): Promise<{
    status: LMSApiResponseStatus;
    announcements: LMSAnnouncement[];
  }> {
    const { status: instructorStatus, instructorIds } =
      await this.getInstructorIds();

    // Get announcements using only_announcements=true
    const { status: announcementStatus, data: announcementData } =
      await this.GetPaginated(
        `courses/${this.integration.apiCourseId}/discussion_topics?only_announcements=true`,
      );

    // Get all discussion topics for instructor posts
    const { status: discussionStatus, data: discussionData } =
      await this.GetPaginated(
        `courses/${this.integration.apiCourseId}/discussion_topics`,
      );

    if (
      announcementStatus != LMSApiResponseStatus.Success &&
      discussionStatus != LMSApiResponseStatus.Success
    ) {
      return { status: announcementStatus, announcements: [] };
    }

    // Filter instructor discussion posts (exclude announcements to avoid duplicates)
    const instructorPosts = discussionData.filter(
      (d: any) =>
        d.posted_at != undefined &&
        !d.is_announcement &&
        d.author &&
        instructorIds.has(d.author.id),
    );

    const data = [...announcementData, ...instructorPosts];

    const announcements: LMSAnnouncement[] = data
      .filter((d: any) => d.posted_at != undefined)
      .map((announcement: any) => {
        return {
          id: announcement.id,
          title: announcement.title,
          message: announcement.message,
          posted:
            announcement.posted_at != undefined &&
            announcement.posted_at.trim() != ''
              ? new Date(announcement.posted_at)
              : undefined,
          modified:
            announcement.last_reply_at != undefined &&
            announcement.last_reply_at.trim() != ''
              ? new Date(announcement.last_reply_at)
              : undefined,
        } as LMSAnnouncement;
      });
    announcements.sort((a0, a1) => {
      if (a0.posted == undefined) return 1;
      else if (a1.posted == undefined) return -1;
      else return a0.posted.getTime() - a1.posted.getTime();
    });

    return {
      status: LMSApiResponseStatus.Success,
      announcements,
    };
  }

  private async getInstructorIds(): Promise<{
    status: LMSApiResponseStatus;
    instructorIds: Set<number>;
  }> {
    const { status, data } = await this.GetPaginated(
      `courses/${this.integration.apiCourseId}/users?sort=username&enrollment_type[]=teacher&enrollment_type[]=ta`,
    );

    if (status != LMSApiResponseStatus.Success)
      return { status, instructorIds: new Set() };

    return {
      status: LMSApiResponseStatus.Success,
      instructorIds: new Set(data.map((user: any) => user.id)),
    };
  }

  async getAssignments(): Promise<{
    status: LMSApiResponseStatus;
    assignments: LMSAssignment[];
  }> {
    const { status, data } = await this.GetPaginated(
      `courses/${this.integration.apiCourseId}/assignments`,
    );

    if (status != LMSApiResponseStatus.Success)
      return { status, assignments: [] };

    const assignments: LMSAssignment[] = data
      .filter((assignment: any) => assignment.published == true)
      .map((assignment: any) => {
        return {
          id: assignment.id,
          name: assignment.name,
          description: assignment.description,
          due:
            assignment.due_at != undefined && assignment.due_at.trim() != ''
              ? new Date(assignment.due_at)
              : undefined,
          modified:
            assignment.updated_at != undefined &&
            assignment.updated_at.trim() != ''
              ? new Date(assignment.updated_at)
              : undefined,
        } as LMSAssignment;
      });

    return {
      status: LMSApiResponseStatus.Success,
      assignments,
    };
  }

  async getPages(): Promise<{
    status: LMSApiResponseStatus;
    pages: LMSPage[];
  }> {
    const pagesKey = `pages_complete_${this.integration.apiCourseId}`;

    if (this.cacheManager) {
      const cachedPages = await this.cacheManager.get(pagesKey);
      if (cachedPages) {
        return cachedPages as {
          status: LMSApiResponseStatus;
          pages: LMSPage[];
        };
      }
    }

    // If not cached, fetch as normal
    const { status, data } = await this.GetPaginated(
      `courses/${this.integration.apiCourseId}/pages`,
    );

    if (status != LMSApiResponseStatus.Success) return { status, pages: [] };

    const pages: LMSPage[] = [];

    // Individual page calls will now be cached by the Get() method
    for (const page of data.filter((datum: any) => datum.published == true)) {
      const pageResult = await this.Get(
        `courses/${this.integration.apiCourseId}/pages/${page.url}`,
      );

      if (pageResult.status === LMSApiResponseStatus.Success) {
        pages.push({
          id: pageResult.data.page_id,
          title: pageResult.data.title,
          body: pageResult.data.body,
          url: page.url,
          frontPage: page.front_page,
          modified: new Date(pageResult.data.updated_at),
        });
      }
    }

    const result = {
      status: LMSApiResponseStatus.Success,
      pages,
    };

    // Cache complete result for 10 minutes
    if (this.cacheManager) {
      await this.cacheManager.set(pagesKey, result, 600000);
    }

    return result;
  }

  async getFiles(): Promise<{
    status: LMSApiResponseStatus;
    files: LMSFile[];
  }> {
    const { status, data } = await this.GetPaginated(
      `courses/${this.integration.apiCourseId}/files`,
    );

    if (status != LMSApiResponseStatus.Success) return { status, files: [] };

    const files: LMSFile[] = data
      .filter((file: any) => !file.locked && !file.hidden)
      .map((file: any) => {
        return {
          id: file.id,
          name: file.display_name || file.filename,
          url: file.url,
          contentType: file['content-type'] || 'application/octet-stream',
          size: file.size || 0,
          modified: file.modified_at ? new Date(file.modified_at) : new Date(),
        } as LMSFile;
      });

    return {
      status: LMSApiResponseStatus.Success,
      files,
    };
  }

  async getQuizzes(): Promise<{
    status: LMSApiResponseStatus;
    quizzes: LMSQuiz[];
  }> {
    const { status, data } = await this.GetPaginated(
      `courses/${this.integration.apiCourseId}/quizzes`,
    );

    if (status != LMSApiResponseStatus.Success) return { status, quizzes: [] };

    const quizzes: LMSQuiz[] = [];

    for (const quiz of data.filter((q: any) => q.published)) {
      const { status: quizStatus, data: quizData } = await this.Get(
        `courses/${this.integration.apiCourseId}/quizzes/${quiz.id}`,
      );

      let questionsData = [];

      if (quizData?.question_count > 0) {
        const { status: questionsStatus, data: questionsResponse } =
          await this.Get(
            `courses/${this.integration.apiCourseId}/quizzes/${quiz.id}/questions`,
          );
        if (questionsStatus === LMSApiResponseStatus.Success) {
          questionsData = questionsResponse || [];
        }
      }

      // Placeholder questions if no questions fetched from the API
      if (questionsData.length === 0 && quizData?.question_count > 0) {
        console.log(
          `Quiz ${quiz.id}: No question details available (likely permissions), using question_count: ${quizData.question_count}`,
        );
        for (let i = 1; i <= quizData.question_count; i++) {
          questionsData.push({
            id: `placeholder_${quiz.id}_${i}`,
            question_text: `Question ${i} (content not accessible via API)`,
            question_type: 'multiple_choice_question',
          });
        }
      }

      if (quizStatus === LMSApiResponseStatus.Success) {
        // Helper function to safely parse dates
        const safeParseDate = (
          dateString: string | null | undefined,
        ): Date | undefined => {
          if (!dateString) return undefined;
          const parsed = new Date(dateString);
          return isNaN(parsed.getTime()) ? undefined : parsed;
        };

        quizzes.push({
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          due: safeParseDate(quiz.due_at),
          unlock: safeParseDate(quiz.unlock_at),
          lock: safeParseDate(quiz.lock_at),
          timeLimit: quiz.time_limit,
          allowedAttempts: quiz.allowed_attempts,
          questions: questionsData,
          modified: safeParseDate(quiz.updated_at) || new Date(),
        } as LMSQuiz);
      }
    }

    return { status: LMSApiResponseStatus.Success, quizzes };
  }

  getDocumentLink(documentId: number, documentType: LMSUpload): string {
    switch (documentType) {
      case LMSUpload.Announcements:
        return `https://${this.integration.orgIntegration.rootUrl}/courses/${this.integration.apiCourseId}/discussion_topics/${documentId}/`;
      case LMSUpload.Assignments:
        return `https://${this.integration.orgIntegration.rootUrl}/courses/${this.integration.apiCourseId}/assignments/${documentId}/`;
      case LMSUpload.Pages:
        return `https://${this.integration.orgIntegration.rootUrl}/courses/${this.integration.apiCourseId}/pages/${documentId}/`;
      case LMSUpload.Files:
        return `https://${this.integration.orgIntegration.rootUrl}/courses/${this.integration.apiCourseId}/files/${documentId}/`;
      case LMSUpload.Quizzes:
        return `https://${this.integration.orgIntegration.rootUrl}/courses/${this.integration.apiCourseId}/quizzes/${documentId}/`;
      default:
        return '';
    }
  }
}
