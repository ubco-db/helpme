import { Injectable } from '@nestjs/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSCourseAPIResponse,
} from '@koh/common';
import { LMSAssignmentModel } from './lmsAssignment.entity';
import { LMSAnnouncementModel } from './lmsAnnouncement.entity';
import { In } from 'typeorm';
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

  async saveItems(
    type: LMSUpload,
    ids?: number[],
  ): Promise<{
    status: LMSApiResponseStatus;
    items: LMSAssignment[] | LMSAnnouncement[];
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

  private async updateItems(type: LMSUpload, data: any) {
    let model: typeof LMSAssignmentModel | typeof LMSAnnouncementModel;
    switch (type) {
      case LMSUpload.Announcements: {
        model = LMSAnnouncementModel;
        break;
      }
      case LMSUpload.Assignments: {
        model = LMSAssignmentModel;
        break;
      }
      default:
        return undefined;
    }

    const persisted = await model.find({
      where: {
        courseId: this.integration.apiCourseId,
        id: In(data.map((a: any) => a.id)),
      },
    });

    for (const p of persisted) {
      const a = data.find((a: any) => a.id == p.id);
      switch (type) {
        case LMSUpload.Announcements: {
          const per = p as unknown as LMSAnnouncementModel;
          const ann = a as unknown as LMSAnnouncement;
          if (new Date(ann.posted).getTime() < new Date(per.posted).getTime()) {
            per.modified = new Date();
            per.posted = new Date(ann.posted);
            a.modified = per.modified;
            await model.upsert(per, ['id']);
          }
          break;
        }
        case LMSUpload.Assignments: {
          const per = p as unknown as LMSAssignmentModel;
          const asg = a as unknown as LMSAssignment;
          if (
            new Date(asg.modified).getTime() < new Date(per.modified).getTime()
          ) {
            per.modified = new Date(asg.modified);
            await model.upsert(per, ['id']);
          }
          break;
        }
      }
    }
  }

  async getAnnouncements(): Promise<{
    status: LMSApiResponseStatus;
    announcements: LMSAnnouncement[];
  }> {
    const { status, data } = await this.GetPaginated(
      `announcements?context_codes[]=course_${this.integration.apiCourseId}`,
    );

    if (status != LMSApiResponseStatus.Success)
      return { status, announcements: [] };

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
    await this.updateItems(LMSUpload.Announcements, announcements);

    return {
      status: LMSApiResponseStatus.Success,
      announcements,
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
    await this.updateItems(LMSUpload.Assignments, assignments);

    return {
      status: LMSApiResponseStatus.Success,
      assignments,
    };
  }

  async saveItems(
    type: LMSUpload,
    ids?: number[],
  ): Promise<{
    status: LMSApiResponseStatus;
    items: LMSAssignment[] | LMSAnnouncement[];
  }> {
    let result: {
      status: LMSApiResponseStatus;
      assignments?: LMSAssignment[];
      announcements?: LMSAnnouncement[];
    };
    let model: typeof LMSAssignmentModel | typeof LMSAnnouncementModel;
    switch (type) {
      case LMSUpload.Assignments:
        result = await this.getAssignments();
        model = LMSAssignmentModel;
        break;
      case LMSUpload.Announcements:
        result = await this.getAnnouncements();
        model = LMSAnnouncementModel;
        break;
      default:
        result = { status: LMSApiResponseStatus.Error };
        break;
    }

    if (result.status != LMSApiResponseStatus.Success) {
      return { status: result.status, items: [] };
    }

    let items: LMSAssignment[] | LMSAnnouncement[];
    switch (type) {
      case LMSUpload.Assignments:
        items = result.assignments;
        break;
      case LMSUpload.Announcements:
        items = result.announcements;
        break;
    }

    let toSave = [...items];
    if (ids != undefined) {
      toSave = toSave.filter((v) => ids.includes(v.id));
    }

    const itms = await model.save(
      toSave.map((i) =>
        model.create({
          ...i,
          courseId: this.integration.courseId,
          modified: new Date(),
        }),
      ),
    );

    return {
      status: LMSApiResponseStatus.Success,
      items: itms.map((i) => {
        switch (type) {
          case LMSUpload.Assignments: {
            const a = i as unknown as LMSAssignmentModel;
            return {
              id: a.id,
              name: a.name,
              description: a.description,
              due: a.due,
              modified: a.modified,
            } as LMSAssignment;
          }
          case LMSUpload.Announcements: {
            const a = i as unknown as LMSAnnouncementModel;
            return {
              id: a.id,
              title: a.title,
              message: a.message,
              posted: a.posted,
              modified: a.modified,
            } as LMSAnnouncement;
          }
          default:
            return {} as any;
        }
      }),
    };
  }
}
