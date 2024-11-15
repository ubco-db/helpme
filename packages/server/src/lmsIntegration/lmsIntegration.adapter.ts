import { Injectable } from '@nestjs/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';

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
  async getStudents() {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAssignments() {
    return null;
  }
}

class CanvasLMSAdapter extends AbstractLMSAdapter {
  async getStudents() {
    const data = await fetch(
      `https://${this.integration.orgIntegration.rootURL}/v1/courses/${this.integration.apiCourseId}/analytics/student_summaries`,
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
        return null;
      });

    return data;
  }

  async getAssignments() {
    const data = await fetch(
      `https://${this.integration.orgIntegration.rootURL}/v1/courses/${this.integration.apiCourseId}/analytics/assignments`,
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
        return null;
      });

    return data;
  }
}
