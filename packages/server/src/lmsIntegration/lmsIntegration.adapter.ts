import { Injectable } from '@nestjs/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { LMSAssignmentModel } from './lmsAssignment.entity';

@Injectable()
export class LMSIntegrationAdapter {
  async getAdapter(integration: LMSCourseIntegrationModel) {
    switch (integration.orgIntegration.apiPlatform) {
      case 'Canvas':
        return new CanvasLMSAdapter(integration);
    }
    return null;
  }
}

export abstract class AbstractLMSAdapter {
  constructor(protected integration: LMSCourseIntegrationModel) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async Get(url: string) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getStudents() {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAssignments() {
    return null;
  }
}

class CanvasLMSAdapter extends AbstractLMSAdapter {
  async Get(path: string) {
    return fetch(
      `https://${this.integration.orgIntegration.rootUrl}/v1/${path}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.integration.apiKey}`,
        },
      },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.statusText);
        } else {
          return response.json();
        }
      })
      .catch((error) => {
        console.log(error);
        return undefined;
      });
  }

  async getStudents(): Promise<string[]> {
    const data = await this.Get(
      `courses/${this.integration.apiCourseId}/enrollments?type[]=StudentEnrollment&state[]=active&per_page=500`,
    );
    if (data == undefined) {
      return [];
    }
    return data
      .filter((student: any) => student.user != undefined)
      .map((student: any) => student.user.name);
  }

  async getAssignments() {
    const data = await this.Get(
      `courses/${this.integration.apiCourseId}/assignments?per_page=500`,
    );
    if (data == undefined) {
      return [];
    }
    return data
      .filter((assignment: any) => assignment.published == true)
      .map((assignment: any) => {
        return {
          id: assignment.id,
          courseId: this.integration.apiCourseId,
          name: assignment.name,
          description: assignment.description,
          trackedAt: new Date(),
          course: this.integration,
        } satisfies LMSAssignmentModel;
      });
  }
}
