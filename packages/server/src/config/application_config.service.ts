import { Injectable } from '@nestjs/common';
import { ApplicationConfigModel } from './application_config.entity';

@Injectable()
export class ApplicationConfigService {
  private config: Record<string, number>;

  async loadConfig(): Promise<void> {
    const configFromDb = await this.fetchConfigFromDatabase();
    this.config = configFromDb;
  }

  private async fetchConfigFromDatabase(): Promise<Record<string, number>> {
    let applicationConfig = await ApplicationConfigModel.findOne();

    if (!applicationConfig) {
      applicationConfig = await ApplicationConfigModel.create().save();
    }

    return {
      max_async_questions: applicationConfig.max_async_questions,
      max_queues_per_course: applicationConfig.max_queues_per_course,
      max_question_types_per_queue:
        applicationConfig.max_question_types_per_queue,
      max_questions_per_queue: applicationConfig.max_questions_per_queue,
      max_semesters: applicationConfig.max_semesters,
    };
  }

  get(key: string): number {
    try {
      return this.config[key];
    } catch (e) {
      return 30;
    }
  }
}
