import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
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
  LMSPostResponseRefreshTokenBody,
  LMSQuiz,
} from '@koh/common';
import { LMSUpload } from './lmsIntegration.service';
import { Cache } from 'cache-manager';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { LMSAuthStateModel } from './lms-auth-state.entity';
import { ConfigService } from '@nestjs/config';
import express from 'express';
import { LMSAccessToken, LMSAccessTokenModel } from './lms-access-token.entity';
import * as crypto from 'crypto';
import { convert as convertHTMLToText } from 'html-to-text';
import { load as convertStringHTMLToTraversableObject } from 'cheerio';
import { validate as isUuid } from 'uuid';
import { getFetchErrorMessage } from 'utils';
import {
  canvasAssignmentSchema,
  canvasAssignmentSubmissionSchema,
  canvasClassicAnswerSchema,
  canvasListPageSchema,
  canvasQuizQuestionSchema,
  canvasQuizSchema,
  canvasQuizSubmissionSchema,
  canvasResourceLinkSchema,
  parseCanvasItems,
  type CanvasAssignmentSubmission,
  type CanvasSubmissionHistory,
} from './canvasResponseSchemas';

/** An essay question of a Classic quiz. */
export type LMSClassicQuestionMapping =
  | {
      status: 'detected';
      lookupUuid: string;
      embeddableQuestionId: number;
    }
  | { status: 'error'; message: string };

export interface LMSClassicQuizQuestion {
  id: number;
  position: number;
  text: string;
  points: number;
  mapping: LMSClassicQuestionMapping;
}

/** A published Classic quiz that may be eligible for autograding. */
export interface LMSClassicQuiz {
  quizId: number;
  title: string;
  /** Null for practice quizzes, which have no graded assignment. */
  assignmentId: number | null;
  postManually: boolean;
  /** Deep link for the "Open SpeedGrader" button; null without an assignment. */
  speedGraderUrl: string | null;
  /** Why this quiz cannot be autograded, or null when it is ready. */
  blockingReason: string | null;
  essayQuestions: LMSClassicQuizQuestion[];
}

export interface LMSClassicQuizCatalogResult {
  status: LMSApiResponseStatus;
  quizzes: LMSClassicQuiz[];
  /** User-visible detail for Canvas response or eligibility failures. */
  message?: string;
}

/** One completed answer of an attempt, read from submission history. */
export interface LMSClassicAttemptAnswer {
  questionId: number;
  /** Submitted essay text with block breaks and entities preserved. */
  text: string;
  /** Existing score for this answer, or null when it is not graded. */
  points: number | null;
  /** Existing grader comment for this answer, or null. */
  comment: string | null;
}

export interface LMSClassicAttempt {
  quizSubmissionId: number;
  userId: number;
  attempt: number;
  postedAt: string | null;
  excused: boolean;
  /**
   * False when Canvas did not provide usable submission history for this
   * attempt. Unreadable attempts carry no answers and must not be treated as
   * blank submissions.
   */
  readable: boolean;
  answers: LMSClassicAttemptAnswer[];
}

export interface LMSClassicAttemptSnapshot {
  quizId: number;
  attempts: LMSClassicAttempt[];
}

export interface LMSClassicAttemptSnapshotResult {
  status: LMSApiResponseStatus;
  snapshot?: LMSClassicAttemptSnapshot;
  /** User-visible detail for Canvas response failures. */
  message?: string;
}

/** Unknown writes may have reached Canvas and must not be replayed automatically. */
export type LMSWriteOutcome =
  'success' | 'rejected' | 'unknown' | 'unsupported';

export interface LMSWriteResult {
  outcome: LMSWriteOutcome;
  httpStatus?: number;
  message?: string;
}

/** Bound Canvas requests; a timed-out write has an unknown outcome. */
const CANVAS_REQUEST_TIMEOUT_MS = 30000;

export function htmlToEssayText(html: unknown): string {
  if (typeof html !== 'string') return '';
  const text = convertHTMLToText(html, {
    wordwrap: false as const,
    // Preserve paragraph breaks, table cells, and student casing when converting HTML.
    selectors: [
      ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((selector) => ({
        selector,
        options: { uppercase: false },
      })),
      {
        selector: 'table',
        format: 'dataTable',
        options: { uppercaseHeaderCells: false },
      },
    ],
  }).replace(/\u00a0/g, ' ');
  return text.trim().length === 0 ? '' : text;
}

/** Lookup UUIDs Canvas places in LTI resource-link iframe URLs. */
export function resourceLinkLookupUuids(html: unknown): string[] {
  if (typeof html !== 'string') return [];
  const uuids = new Set<string>();
  const $ = convertStringHTMLToTraversableObject(html);
  $('iframe[src]').each((_, iframe) => {
    const src = $(iframe).attr('src');
    if (!src) return;
    try {
      const uuid = new URL(src, 'https://canvas.invalid').searchParams.get(
        'resource_link_lookup_uuid',
      );
      if (uuid && isUuid(uuid)) {
        uuids.add(uuid.toLowerCase());
      }
    } catch {
      // Invalid iframe URLs cannot identify a Canvas resource link.
    }
  });
  return [...uuids];
}

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

      const raw = (await response.json()) as LMSPostResponseRefreshTokenBody;
      const updated = await accessToken.encryptToken({
        ...token, // old token
        ...raw, // new token attributes (just in case anything changed. Also RefreshTokenBody is a subset of the regular POST body)
        refresh_token: token.refresh_token, // just to be explicit: we must RE-USE existing refresh token according to canvas api docs https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth_endpoints#post-login-oauth2-token
      });

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
    // const orgSettings = await OrganizationSettingsModel.findOne({
    //   where: {
    //     organizationId: this.integration.orgIntegration.organizationId,
    //   },
    // });
    // TODO: TEMPORARY: Allow API Keys through even if organization settings disallows adding them
    if (this.integration.apiKey != undefined) {
      // && orgSettings?.allowLMSApiKey) {
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

  /**
   * Classic quizzes with their essay questions and eligibility reasons.
   * Unsupported platforms report the platform as invalid.
   */
  async getClassicQuizCatalog(
    onlyQuizId?: number,
  ): Promise<LMSClassicQuizCatalogResult> {
    return { status: LMSApiResponseStatus.InvalidPlatform, quizzes: [] };
  }

  /**
   * Completed attempt snapshots for every student of a Classic quiz.
   */
  async getClassicAttemptSnapshots(params: {
    quizId: number;
    assignmentId: number;
  }): Promise<LMSClassicAttemptSnapshotResult> {
    return { status: LMSApiResponseStatus.InvalidPlatform };
  }

  /** Write the score and comment for every safe question of one attempt. */
  async putClassicAttemptGrades(params: {
    quizId: number;
    quizSubmissionId: number;
    /** Required by Canvas: the completed attempt being updated. */
    attempt: number;
    /** One entry per question being written. */
    questions: { questionId: number; score: number; comment: string }[];
  }): Promise<LMSWriteResult> {
    return {
      outcome: 'unsupported',
      message: 'Classic quiz grading is not supported by this LMS platform.',
    };
  }

  async putSubmissionComment(params: {
    assignmentId: number;
    userId: number;
    text: string;
  }): Promise<LMSWriteResult> {
    return {
      outcome: 'unsupported',
      message: 'Submission comments are not supported by this LMS platform.',
    };
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

/**
 * Scopes the course Access Token requires. In Canvas, open Admin -> Developer
 * Keys -> edit HelpMe's developer key -> Select scopes and enable these.
 *
 * "Allow Include Parameters" must also be enabled on the developer key, because
 * Canvas silently ignores `include[]` (including `include[]=submission_history`)
 * for scoped OAuth requests when it is off.
 */
export const CANVAS_ACCESS_TOKEN_SCOPES: readonly string[] = [
  // For document sync
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

  // For auto-grader.
  'url:GET|/api/v1/courses/:course_id/lti_resource_links/:id',
  'url:GET|/api/v1/courses/:course_id/assignments/:assignment_id/submissions',
  'url:GET|/api/v1/courses/:course_id/quizzes/:quiz_id/submissions',
  'url:PUT|/api/v1/courses/:course_id/quizzes/:quiz_id/submissions/:id',
  //This last endpoint adds one "HUMAN REVIEW REQUIRED" submission comment only when the
  // model returns a non-empty `human_review_reason` (technical failures stay in the HelpMe report).
  // The staff should delete the comment after reviewing it and before they publish the grades.
  'url:PUT|/api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id',
];

export class CanvasLMSAdapter extends ImplementedLMSAdapter {
  private readonly logger = new Logger(CanvasLMSAdapter.name);

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
    const uri = `${organizationIntegration.secure ? 'https' : 'http'}://${organizationIntegration.rootUrl}/login/oauth2/auth`;

    const state = await super.createState(
      organizationIntegration,
      userId,
      redirectUrl,
    );

    const query = new URLSearchParams({
      client_id: organizationIntegration.clientId,
      response_type: 'code',
      state: state.state,
      scope: CANVAS_ACCESS_TOKEN_SCOPES.join(' '),
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
    return this.requestGet(path, true);
  }

  private canvasBaseUrl(): string {
    return `${this.integration.orgIntegration.secure ? 'https' : 'http'}://${this.integration.orgIntegration.rootUrl}`;
  }

  /**
   * Issue a Canvas GET.
   *
   * Document sync uses the cache. The autograder passes `cache = false` so it
   * always observes the live state of submissions instead of a cached document
   * sync response.
   */
  private async requestGet(
    path: string,
    cache = false,
  ): Promise<{
    status: LMSApiResponseStatus;
    data?: any;
    nextLink?: string;
    message?: string;
  }> {
    const url = `${this.canvasBaseUrl()}/api/v1/${path}`;

    if (cache && this.cacheManager) {
      const cached = await this.cacheManager.get(url);
      if (cached) {
        return cached as {
          status: LMSApiResponseStatus;
          data?: any;
          nextLink?: string;
          message?: string;
        };
      }
    }

    const authorization = await this.getAuthorization();
    let result: {
      status: LMSApiResponseStatus;
      data?: any;
      nextLink?: string;
      message?: string;
    };
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(CANVAS_REQUEST_TIMEOUT_MS),
        headers: { Authorization: authorization },
      });
      if (!response.ok) {
        switch (response.status) {
          case 401:
            result = { status: LMSApiResponseStatus.Unauthorized };
            break;
          case 403:
            result = { status: LMSApiResponseStatus.Forbidden };
            break;
          case 404:
            result = { status: LMSApiResponseStatus.InvalidCourseId };
            break;
          default:
            throw new Error(`Canvas returned HTTP ${response.status}`);
        }
      } else {
        const data: unknown = await response.json();
        result = {
          status: LMSApiResponseStatus.Success,
          data,
          nextLink: this.parseNextLink(response.headers.get('link')),
        };
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Error contacting ${this.integration.orgIntegration.rootUrl}: ${detail}`,
      );
      result = {
        status: LMSApiResponseStatus.Error,
        message: `Could not reach Canvas (${detail}).`,
      };
    }

    // Cache successful responses for 5 minutes.
    if (
      cache &&
      this.cacheManager &&
      result.status === LMSApiResponseStatus.Success
    ) {
      await this.cacheManager.set(url, result, 300000);
    }

    return result;
  }

  /** Extract the `next` pagination path from a Canvas `Link` header. */
  private parseNextLink(linkHeader: string | null): string | undefined {
    if (!linkHeader) return undefined;
    const next = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (!next) return undefined;
    try {
      const url = new URL(next[1]);
      const marker = '/api/v1/';
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex === -1) return undefined;
      return `${url.pathname.slice(markerIndex + marker.length)}${url.search}`;
    } catch {
      return undefined;
    }
  }

  /**
   * Paginate a Canvas list endpoint.
   *
   * Accept plain arrays and wrapped lists. A malformed page fails the whole read
   * so a broken response cannot silently hide data.
   */
  private async getPaginated(
    initialPath: string,
    options: { cache?: boolean; wrapKey?: string } = {},
  ): Promise<{
    status: LMSApiResponseStatus;
    items: unknown[];
    message?: string;
  }> {
    const items: unknown[] = [];
    let nextLink = initialPath.includes('?')
      ? `${initialPath}&per_page=50`
      : `${initialPath}?per_page=50`;

    while (nextLink !== undefined) {
      const res = await this.requestGet(nextLink, options.cache ?? true);
      if (res.status !== LMSApiResponseStatus.Success) {
        return { status: res.status, items: [], message: res.message };
      }

      const page = canvasListPageSchema(options.wrapKey).safeParse(res.data);
      if (!page.success) {
        return {
          status: LMSApiResponseStatus.Error,
          items: [],
          message: `Canvas returned an unexpected response while reading ${initialPath}; expected a list.`,
        };
      }

      items.push(...page.data);
      nextLink = res.nextLink;
    }

    return { status: LMSApiResponseStatus.Success, items };
  }

  async GetPaginated(
    initialPath: string,
  ): Promise<{ status: LMSApiResponseStatus; data?: any }> {
    const result = await this.getPaginated(initialPath, { cache: true });
    return { status: result.status, data: result.items };
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

    if (status !== LMSApiResponseStatus.Success) return { status, quizzes: [] };

    const quizzes: LMSQuiz[] = [];

    for (const quiz of data.filter((q: any) => q.published)) {
      // This isn't necessary? the /quizzes endpoint already retrieves all the metadata for each quiz I believe
      // Also it fails with an "insufficient scopes" error
      // const { status: quizStatus, data: quizData } = await this.Get(
      //   `courses/${this.integration.apiCourseId}/quizzes/${quiz.id}`,
      // );

      let questionsData = [];

      if (quiz.question_count > 0) {
        const { status: questionsStatus, data: questionsResponse } =
          await this.Get(
            `courses/${this.integration.apiCourseId}/quizzes/${quiz.id}/questions`,
          );
        if (questionsStatus === LMSApiResponseStatus.Success) {
          questionsData = questionsResponse || [];
        }
      }

      // Placeholder questions if no questions fetched from the API
      if (questionsData.length === 0 && quiz.question_count > 0) {
        console.log(
          `Quiz ${quiz.id}: No question details available (likely permissions), using question_count: ${quiz.question_count}`,
        );
        for (let i = 1; i <= quiz.question_count; i++) {
          questionsData.push({
            id: `placeholder_${quiz.id}_${i}`,
            question_text: `Question ${i} (content not accessible via API)`,
            question_type: 'multiple_choice_question',
          });
        }
      }

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
      } satisfies LMSQuiz);
    }

    return { status: LMSApiResponseStatus.Success, quizzes };
  }

  async getClassicQuizCatalog(
    onlyQuizId?: number,
  ): Promise<LMSClassicQuizCatalogResult> {
    const courseId = this.integration.apiCourseId;

    // The assignment carries the posting policy.
    const quizList = await this.getPaginated(`courses/${courseId}/quizzes`, {
      cache: false,
    });
    const assignmentList = await this.getPaginated(
      `courses/${courseId}/assignments`,
      { cache: false },
    );

    if (quizList.status !== LMSApiResponseStatus.Success) {
      return {
        status: quizList.status,
        quizzes: [],
        message: quizList.message ?? quizList.status,
      };
    }
    if (assignmentList.status !== LMSApiResponseStatus.Success) {
      return {
        status: assignmentList.status,
        quizzes: [],
        message: assignmentList.message ?? assignmentList.status,
      };
    }

    const parsedAssignments = parseCanvasItems(
      canvasAssignmentSchema,
      assignmentList.items,
      'assignment',
    );
    if ('error' in parsedAssignments) {
      return {
        status: LMSApiResponseStatus.Error,
        quizzes: [],
        message: parsedAssignments.error,
      };
    }
    const assignmentsById = new Map(
      parsedAssignments.items.map((assignment) => [assignment.id, assignment]),
    );

    const parsedQuizzes = parseCanvasItems(
      canvasQuizSchema,
      quizList.items,
      'quiz',
    );
    if ('error' in parsedQuizzes) {
      return {
        status: LMSApiResponseStatus.Error,
        quizzes: [],
        message: parsedQuizzes.error,
      };
    }

    const quizzes: LMSClassicQuiz[] = [];
    let requestedQuizFound = false;
    for (const quiz of parsedQuizzes.items) {
      if (onlyQuizId !== undefined && quiz.id !== onlyQuizId) {
        continue;
      }
      requestedQuizFound = true;

      const assignmentId = quiz.assignment_id ?? null;
      const assignment =
        assignmentId === null ? null : assignmentsById.get(assignmentId);
      const reasons: string[] = [];
      if (quiz.published !== true) {
        reasons.push(
          'This Canvas quiz is not published. Publish it in Canvas before starting the autograder.',
        );
      }
      if (assignmentId === null) {
        reasons.push(
          'This is a practice quiz (a Classic quiz with no graded assignment), so it does not produce a graded submission and cannot be autograded.',
        );
      } else if (!assignment) {
        reasons.push(
          `Canvas did not return the assignment for this quiz (assignment ${assignmentId}). Make sure the owner of the Access Token that's being used for this Canvas Integration can read the course's assignments, then reload this page. Otherwise, contact a HelpMe admin.`,
        );
      }
      let blockingReason = reasons.length > 0 ? reasons.join(' ') : null;

      const essayQuestions: LMSClassicQuizQuestion[] = [];
      if (blockingReason === null) {
        const questionList = await this.getPaginated(
          `courses/${courseId}/quizzes/${quiz.id}/questions`,
          { cache: false },
        );
        if (questionList.status !== LMSApiResponseStatus.Success) {
          blockingReason =
            questionList.message ??
            `Canvas could not return the questions for this quiz (${questionList.status}).`;
        } else {
          const parsedQuestions = parseCanvasItems(
            canvasQuizQuestionSchema,
            questionList.items,
            `question in Canvas quiz ${quiz.id}`,
          );
          if ('error' in parsedQuestions) {
            blockingReason = parsedQuestions.error;
          } else {
            for (const [
              questionIndex,
              question,
            ] of parsedQuestions.items.entries()) {
              if (question.question_type !== 'essay_question') {
                continue;
              }
              const position =
                question.position !== null &&
                question.position !== undefined &&
                question.position > 0
                  ? question.position
                  : questionIndex + 1;
              essayQuestions.push({
                id: question.id,
                position,
                text: htmlToEssayText(question.question_text),
                points: question.points_possible ?? 0,
                mapping: await this.resolveQuestionMapping(
                  question.question_text,
                  position,
                  quiz.id,
                ),
              });
            }
          }
        }
      }

      quizzes.push({
        quizId: quiz.id,
        title: quiz.title ?? '',
        assignmentId,
        postManually: assignment?.post_manually ?? quiz.post_manually ?? false,
        speedGraderUrl:
          assignmentId === null ? null : this.speedGraderUrl(assignmentId),
        blockingReason,
        essayQuestions,
      });
    }

    if (onlyQuizId !== undefined && !requestedQuizFound) {
      return {
        status: LMSApiResponseStatus.Error,
        quizzes: [],
        message: `Canvas quiz ${onlyQuizId} was not found in this course, or it is not a Classic quiz. Make sure the Access Token belongs to a user enrolled in this Canvas course.`,
      };
    }

    return { status: LMSApiResponseStatus.Success, quizzes };
  }

  private async resolveQuestionMapping(
    html: unknown,
    position: number,
    quizId: number,
  ): Promise<LMSClassicQuestionMapping> {
    const lookupUuids = resourceLinkLookupUuids(html);
    if (lookupUuids.length === 0) {
      return {
        status: 'error',
        message: `Question ${position} does not contain a HelpMe embeddable question. Insert it into this Canvas question with Apps → HelpMe, then reload this page.`,
      };
    }

    const helpMeLinks: Extract<
      LMSClassicQuestionMapping,
      { status: 'detected' }
    >[] = [];
    for (const lookupUuid of lookupUuids) {
      const response = await this.requestGet(
        `courses/${this.integration.apiCourseId}/lti_resource_links/lookup_uuid:${lookupUuid}`,
      );
      if (response.status !== LMSApiResponseStatus.Success) {
        return {
          status: 'error',
          message: `Question ${position} in Canvas quiz ${quizId}: Canvas could not resolve the embedded resource link (${response.message ?? response.status}). Try re-inserting the embeddable HelpMe question.`,
        };
      }
      const parsed = canvasResourceLinkSchema.safeParse(response.data);
      if (!parsed.success) {
        return {
          status: 'error',
          message: `Question ${position} in Canvas quiz ${quizId}: Canvas returned an unexpected invalid resource-link response (${JSON.stringify(response.data, null, 2)}). Contact a HelpMe admin.`,
        };
      }
      const embeddableQuestionId =
        parsed.data.custom?.helpme_question_id ?? null;
      if (embeddableQuestionId !== null) {
        helpMeLinks.push({
          status: 'detected',
          lookupUuid,
          embeddableQuestionId,
        });
      }
    }
    if (helpMeLinks.length !== 1) {
      return {
        status: 'error',
        message:
          helpMeLinks.length === 0
            ? `Question ${position} in Canvas quiz ${quizId} does not contain a recognizable HelpMe embeddable question. Re-insert it with Apps → HelpMe.`
            : `Question ${position} in Canvas quiz ${quizId} contains more than one HelpMe embeddable question. Remove the extra one so each Canvas question maps to exactly one HelpMe question.`,
      };
    }
    return helpMeLinks[0];
  }

  async putClassicAttemptGrades(params: {
    quizId: number;
    quizSubmissionId: number;
    /** Required by Canvas: the completed attempt being updated. */
    attempt: number;
    /** One entry per question being written. */
    questions: { questionId: number; score: number; comment: string }[];
  }): Promise<LMSWriteResult> {
    if (params.questions.length === 0) {
      return {
        outcome: 'rejected',
        message: 'At least one question score is required.',
      };
    }

    // Update question scores together, without overriding Canvas's aggregate score.
    const questions = Object.fromEntries(
      params.questions.map(({ questionId, score, comment }) => [
        questionId,
        { score, comment },
      ]),
    );

    return this.sendCanvasWrite(
      `courses/${this.integration.apiCourseId}/quizzes/${params.quizId}/submissions/${params.quizSubmissionId}`,
      {
        quiz_submissions: [
          {
            // Canvas rejects the request when the attempt is missing.
            attempt: params.attempt,
            questions,
          },
        ],
      },
    );
  }

  /** Adds a submission comment. It does not post a manually posted grade. */
  async putSubmissionComment(params: {
    assignmentId: number;
    userId: number;
    text: string;
  }): Promise<LMSWriteResult> {
    return this.sendCanvasWrite(
      `courses/${this.integration.apiCourseId}/assignments/${params.assignmentId}/submissions/${params.userId}`,
      { comment: { text_comment: params.text } },
    );
  }

  private speedGraderUrl(assignmentId: number): string {
    return `${this.canvasBaseUrl()}/courses/${this.integration.apiCourseId}/gradebook/speed_grader?assignment_id=${assignmentId}`;
  }

  async getClassicAttemptSnapshots(ref: {
    quizId: number;
    assignmentId: number;
  }): Promise<LMSClassicAttemptSnapshotResult> {
    const courseId = this.integration.apiCourseId;

    const quizSubmissions = await this.getPaginated(
      `courses/${courseId}/quizzes/${ref.quizId}/submissions`,
      { cache: false, wrapKey: 'quiz_submissions' },
    );
    const assignmentSubmissions = await this.getPaginated(
      `courses/${courseId}/assignments/${ref.assignmentId}/submissions?include[]=submission_history`,
      { cache: false },
    );

    if (quizSubmissions.status !== LMSApiResponseStatus.Success) {
      return {
        status: quizSubmissions.status,
        message: quizSubmissions.message ?? quizSubmissions.status,
      };
    }
    if (assignmentSubmissions.status !== LMSApiResponseStatus.Success) {
      return {
        status: assignmentSubmissions.status,
        message: assignmentSubmissions.message ?? assignmentSubmissions.status,
      };
    }

    const parsedQuizSubmissions = parseCanvasItems(
      canvasQuizSubmissionSchema,
      quizSubmissions.items,
      'quiz submission',
    );
    if ('error' in parsedQuizSubmissions) {
      return {
        status: LMSApiResponseStatus.Error,
        message: parsedQuizSubmissions.error,
      };
    }
    const parsedAssignmentSubmissions = parseCanvasItems(
      canvasAssignmentSubmissionSchema,
      assignmentSubmissions.items,
      'assignment submission',
    );
    if ('error' in parsedAssignmentSubmissions) {
      return {
        status: LMSApiResponseStatus.Error,
        message: parsedAssignmentSubmissions.error,
      };
    }

    const submissionsByUser = new Map<number, CanvasAssignmentSubmission>(
      parsedAssignmentSubmissions.items.map((submission) => [
        submission.user_id,
        submission,
      ]),
    );

    const trustedAttempts = new Map<
      string,
      { quizSubmissionId: number; userId: number; attempt: number }
    >();
    const currentByUser = new Map<
      number,
      { quizSubmissionId: number; attempt: number; completed: boolean }
    >();
    for (const quizSubmission of parsedQuizSubmissions.items) {
      const workflowState = quizSubmission.workflow_state ?? null;
      const completed =
        workflowState === 'complete' || workflowState === 'pending_review';
      const current = currentByUser.get(quizSubmission.user_id);
      if (
        !current ||
        quizSubmission.attempt > current.attempt ||
        (quizSubmission.attempt === current.attempt &&
          completed &&
          !current.completed)
      ) {
        currentByUser.set(quizSubmission.user_id, {
          quizSubmissionId: quizSubmission.id,
          attempt: quizSubmission.attempt,
          completed,
        });
      }
      // Only finished attempts are eligible for autograding: a student has
      // submitted and Canvas has either marked it complete or is holding it for
      // manual review. Preview, in-progress, untaken, and settings rows are
      // excluded.
      if (!completed) {
        continue;
      }
      trustedAttempts.set(
        `${quizSubmission.user_id}:${quizSubmission.attempt}`,
        {
          quizSubmissionId: quizSubmission.id,
          userId: quizSubmission.user_id,
          attempt: quizSubmission.attempt,
        },
      );
    }

    // Canvas returns the current quiz-submission row. The assignment submission
    // history is therefore the source of completed attempt numbers and answers,
    // while the documented quiz-submission list remains the trust anchor for
    // user/submission identity. A later attempt proves earlier history attempts
    // were finished; an explicitly non-final history state is still excluded.
    for (const [userId, current] of currentByUser) {
      const submission = submissionsByUser.get(userId);
      for (const history of submission?.submission_history ?? []) {
        const attempt = history.attempt ?? null;
        if (attempt === null || attempt > current.attempt) {
          continue;
        }
        const workflowState = history.workflow_state ?? null;
        if (
          workflowState !== null &&
          workflowState !== 'complete' &&
          workflowState !== 'pending_review'
        ) {
          continue;
        }
        if (
          attempt === current.attempt &&
          !current.completed &&
          workflowState === null
        ) {
          continue;
        }
        const key = `${userId}:${attempt}`;
        if (!trustedAttempts.has(key)) {
          trustedAttempts.set(key, {
            quizSubmissionId: current.quizSubmissionId,
            userId,
            attempt,
          });
        }
      }
    }

    const attempts = [...trustedAttempts.values()]
      .sort((left, right) =>
        left.userId === right.userId
          ? left.attempt - right.attempt
          : left.userId - right.userId,
      )
      .map((candidate) =>
        this.buildClassicAttempt({
          ...candidate,
          submission: submissionsByUser.get(candidate.userId),
        }),
      );

    return {
      status: LMSApiResponseStatus.Success,
      snapshot: { quizId: ref.quizId, attempts },
    };
  }

  private buildClassicAttempt(input: {
    quizSubmissionId: number;
    userId: number;
    attempt: number;
    submission: CanvasAssignmentSubmission | undefined;
  }): LMSClassicAttempt {
    const { quizSubmissionId, userId, attempt, submission } = input;
    const record = this.findAttemptRecord(submission, attempt);
    const data = record?.submission_data ?? null;
    const answers = data === null ? null : this.readClassicAnswers(data);

    return {
      quizSubmissionId,
      userId,
      attempt,
      postedAt: record?.posted_at ?? submission?.posted_at ?? null,
      excused: record?.excused ?? submission?.excused ?? false,
      // A missing or malformed history is reported as unreadable instead of an
      // attempt with no answers.
      readable: answers !== null,
      answers: answers ?? [],
    };
  }

  /**
   * Locate the submission record holding the answers for `attempt`.
   *
   * Completed answers come from matching submission history or the current
   * assignment submission's data. The quiz question endpoint is never used.
   * Returns null when neither source contains usable data for the attempt.
   */
  private findAttemptRecord(
    submission: CanvasAssignmentSubmission | undefined,
    attempt: number,
  ): CanvasSubmissionHistory | CanvasAssignmentSubmission | null {
    if (!submission) return null;

    // Prefer matching history; Canvas can also return answers on the current
    // submission.
    return (
      [...(submission.submission_history ?? []), submission].find(
        (entry) =>
          entry.attempt === attempt && Array.isArray(entry.submission_data),
      ) ?? null
    );
  }

  private readClassicAnswers(data: unknown[]): LMSClassicAttemptAnswer[] {
    const answers: LMSClassicAttemptAnswer[] = [];
    for (const rawEntry of data) {
      // Mixed quizzes include non-essay answer shapes such as file uploads.
      // Ignore entries that cannot be represented as essay answers; a mapped
      // essay with malformed fields is then handled as a missing answer.
      const parsed = canvasClassicAnswerSchema.safeParse(rawEntry);
      if (!parsed.success) continue;
      const answer = parsed.data;
      // Canvas serializes an unanswered grading decision for Classic essay
      // questions as `points: 0` together with `correct: "undefined"`.
      // Treating that placeholder zero as an instructor grade would skip every
      // newly submitted essay before HelpMe can grade it.
      const ungradedPlaceholder = answer.correct === 'undefined';
      answers.push({
        questionId: answer.question_id,
        text: htmlToEssayText(answer.text),
        points: ungradedPlaceholder ? null : (answer.points ?? null),
        comment: answer.more_comments ?? answer.comment ?? null,
      });
    }
    return answers;
  }

  /**
   * Send a Canvas PUT and classify its outcome.
   *
   * The request is never retried. Server/proxy errors and timeouts can happen
   * after a write was accepted, so their outcome is unknown.
   */
  private async sendCanvasWrite(
    path: string,
    body: unknown,
  ): Promise<LMSWriteResult> {
    let authorization: string;
    try {
      authorization = await this.getAuthorization();
    } catch (error) {
      return {
        outcome: 'rejected',
        message:
          error instanceof Error ? error.message : 'Authorization failed.',
      };
    }

    try {
      const response = await fetch(`${this.canvasBaseUrl()}/api/v1/${path}`, {
        method: 'PUT',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(CANVAS_REQUEST_TIMEOUT_MS),
      });

      if (response.ok) {
        return { outcome: 'success', httpStatus: response.status };
      }

      return {
        outcome:
          response.status >= 500 || response.status === 408
            ? 'unknown'
            : 'rejected',
        httpStatus: response.status,
        message: await this.readCanvasWriteErrorMessage(response),
      };
    } catch (error) {
      return {
        outcome: 'unknown',
        message:
          error instanceof Error ? error.message : 'Unknown transport error.',
      };
    }
  }

  private async readCanvasWriteErrorMessage(
    response: Response,
  ): Promise<string> {
    if (response.status === 401) return LMSApiResponseStatus.Unauthorized;
    if (response.status === 403) return LMSApiResponseStatus.Forbidden;
    return getFetchErrorMessage(
      response,
      `Canvas returned HTTP ${response.status}.`,
    );
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
