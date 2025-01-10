import { Injectable } from '@nestjs/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  LMSAnnouncement,
  LMSAnnouncementAPIResponse,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSAssignmentAPIResponse,
  LMSCourseAPIResponse,
} from '@koh/common';
import { LMSAssignmentModel } from './lmsAssignment.entity';
import { LMSAnnouncementModel } from './lmsAnnouncement.entity';

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
    announcements: LMSAnnouncementAPIResponse[];
  }> {
    return null;
  }

  async getAssignments(): Promise<{
    status: LMSApiResponseStatus;
    assignments: LMSAssignmentAPIResponse[];
  }> {
    return null;
  }

  async saveAssignments(
    ids?: number[],
  ): Promise<{ status: LMSApiResponseStatus; assignments: LMSAssignment[] }> {
    return null;
  }

  async saveAnnouncements(
    ids?: number[],
  ): Promise<{
    status: LMSApiResponseStatus;
    announcements: LMSAnnouncement[];
  }> {
    return null;
  }
}

abstract class ImplementedLMSAdapter extends AbstractLMSAdapter {
  isImplemented(): boolean {
    return true;
  }
}

export class BaseLMSAdapter extends AbstractLMSAdapter {}

class CanvasLMSAdapter extends ImplementedLMSAdapter {
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
      .catch(() => {
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
    announcements: LMSAnnouncementAPIResponse[];
  }> {
    const { status, data } = await this.GetPaginated(
      `announcements?context_codes[]=${this.integration.apiCourseId}&active_only=true`,
    );

    if (status != LMSApiResponseStatus.Success)
      return { status, announcements: [] };

    return {
      status: LMSApiResponseStatus.Success,
      announcements: data.map((announcement: any) => {
        return {
          id: announcement.id,
          title: announcement.title,
          message: announcement.message,
          posted: new Date(announcement.posted),
        } satisfies LMSAnnouncementAPIResponse;
      }),
    };
  }

  async getAssignments(): Promise<{
    status: LMSApiResponseStatus;
    assignments: LMSAssignmentAPIResponse[];
  }> {
    const { status, data } = await this.GetPaginated(
      `courses/${this.integration.apiCourseId}/assignments`,
    );

    if (status != LMSApiResponseStatus.Success)
      return { status, assignments: [] };

    return {
      status: LMSApiResponseStatus.Success,
      assignments: data
        .filter((assignment: any) => assignment.published == true)
        .map((assignment: any) => {
          return {
            id: assignment.id,
            name: assignment.name,
            description: assignment.description,
            due: new Date(assignment.due_at),
            modified: new Date(assignment.updated_at),
          } satisfies LMSAssignmentAPIResponse;
        }),
    };
  }

  async saveAssignments(
    ids?: number[],
  ): Promise<{ status: LMSApiResponseStatus; assignments: LMSAssignment[] }> {
    const { status, assignments } = await this.getAssignments();
    if (status != LMSApiResponseStatus.Success)
      return { status, assignments: [] };

    let toSave = [...assignments];
    if (ids != undefined) {
      toSave = toSave.filter((v) => ids.includes(v.id));
    }

    const assgn = await LMSAssignmentModel.save(
      toSave.map((a) => {
        const assignment = new LMSAssignmentModel();
        assignment.trackedAt = new Date();
        assignment.description = a.description;
        assignment.name = a.name;
        assignment.due = a.due;
        assignment.courseId = this.integration.courseId;
        assignment.id = a.id;
        return assignment;
      }),
    );

    return {
      status: LMSApiResponseStatus.Success,
      assignments: assgn.map((a) => {
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          due: a.due,
          modified: a.modified,
          trackedAt: a.trackedAt,
        } as LMSAssignment;
      }),
    };
  }

  async saveAnnouncements(
    ids?: number[],
  ): Promise<{
    status: LMSApiResponseStatus;
    announcements: LMSAnnouncement[];
  }> {
    const { status, announcements } = await this.getAnnouncements();
    if (status != LMSApiResponseStatus.Success)
      return { status, announcements: [] };

    let toSave = [...announcements];
    if (ids != undefined) {
      toSave = toSave.filter((v) => ids.includes(v.id));
    }

    const ann = await LMSAnnouncementModel.save(
      toSave.map((a) => {
        const announcement = new LMSAnnouncementModel();
        announcement.courseId = this.integration.courseId;
        announcement.id = a.id;
        announcement.title = a.title;
        announcement.message = a.message;
        announcement.posted = a.posted;
        return announcement;
      }),
    );

    return {
      status: LMSApiResponseStatus.Success,
      announcements: ann.map((a) => {
        return {
          id: a.id,
          title: a.title,
          message: a.message,
          posted: a.posted,
        } as LMSAnnouncement;
      }),
    };
  }
}
