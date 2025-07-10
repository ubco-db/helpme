import { Injectable } from '@nestjs/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSCourseAPIResponse,
  LMSFile,
  LMSIntegrationPlatform,
  LMSPage,
} from '@koh/common';
import { LMSUpload } from './lmsIntegration.service';

@Injectable()
export class LMSIntegrationAdapter {
  async getAdapter(integration: LMSCourseIntegrationModel) {
    switch (integration.orgIntegration.apiPlatform) {
      case 'Canvas':
        return new CanvasLMSAdapter(integration);
    }
    return new BaseLMSAdapter(integration);
  }
}

export abstract class AbstractLMSAdapter {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  constructor(protected integration: LMSCourseIntegrationModel) {}

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
  getPlatform(): LMSIntegrationPlatform {
    return LMSIntegrationPlatform.Canvas;
  }

  async Get(
    path: string,
  ): Promise<{ status: LMSApiResponseStatus; data?: any; nextLink?: string }> {
    return fetch(
      `https://${this.integration.orgIntegration.rootUrl}/api/v1/${path}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.integration.apiKey}`,
        },
      },
    )
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
    const { status, data } = await this.GetPaginated(
      `courses/${this.integration.apiCourseId}/pages`,
    );

    if (status != LMSApiResponseStatus.Success) return { status, pages: [] };

    const pages: LMSPage[] = [];

    for (const page of data) {
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

    return {
      status: LMSApiResponseStatus.Success,
      pages,
    };
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
          // Parent context - Canvas files can be associated with folders but we'll set as standalone for now
          parentType: 'standalone' as const,
          parentId: undefined,
          parentName: undefined,
        } as LMSFile;
      });

    return {
      status: LMSApiResponseStatus.Success,
      files,
    };
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
      default:
        return '';
    }
  }
}
