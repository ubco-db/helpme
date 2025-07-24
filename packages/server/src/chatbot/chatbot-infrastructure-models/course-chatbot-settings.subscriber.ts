import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { CourseChatbotSettingsModel } from './course-chatbot-settings.entity';
import { pick } from 'lodash';
import { ChatbotApiService } from '../chatbot-api.service';
import { ChatbotSettingsMetadata } from '@koh/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { HttpException } from '@nestjs/common';

@EventSubscriber()
export class CourseChatbotSettingsSubscriber
  implements EntitySubscriberInterface<CourseChatbotSettingsModel>
{
  constructor(
    private dataSource: DataSource,
    private chatbotApiService: ChatbotApiService,
    @InjectDataSource('chatbot')
    private chatbotDataSource: DataSource,
  ) {
    dataSource.subscribers.push(this);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  listenTo() {
    return CourseChatbotSettingsModel;
  }

  async afterInsert(
    event: InsertEvent<CourseChatbotSettingsModel>,
  ): Promise<void> {
    await this.afterUpsert(event);
  }

  async afterUpdate(
    event: UpdateEvent<CourseChatbotSettingsModel>,
  ): Promise<void> {
    await this.afterUpsert(event);
  }

  async afterUpsert(
    event:
      | UpdateEvent<CourseChatbotSettingsModel>
      | InsertEvent<CourseChatbotSettingsModel>,
  ): Promise<void> {
    // upsert corresponding table entry in chatbot db

    const courseChatbotSettings = await event.manager.findOne(
      CourseChatbotSettingsModel,
      {
        where: { id: event.entity.id },
        relations: {
          organizationSettings: true,
          llmModel: {
            provider: {
              defaultModel: true,
              defaultVisionModel: true,
            },
          },
        },
      },
    );

    await this.updateChatbotRepository(courseChatbotSettings, 'upsert');
  }

  async beforeRemove(
    event: RemoveEvent<CourseChatbotSettingsModel>,
  ): Promise<void> {
    // due to cascades entity is not guaranteed to be loaded
    if (!event.entity) {
      return;
    }
    // delete corresponding table entry in chatbot db
    if (event.entity instanceof CourseChatbotSettingsModel) {
      await this.updateChatbotRepository(event.entity, 'remove');
    } else {
      await this.updateChatbotRepository(
        await CourseChatbotSettingsModel.findOne({
          where: { id: event.entityId },
        }),
        'remove',
      );
    }
  }

  private async updateChatbotRepository(
    entity: CourseChatbotSettingsModel,
    operation: 'upsert' | 'remove',
  ): Promise<void> {
    const findExisting = (
      await this.chatbotDataSource.query(
        'SELECT * FROM course_setting WHERE "pageContent" = $1',
        [String(entity.courseId)],
      )
    )[0];
    const metadata = await this.metadataifyCourseSetting(entity);
    if (findExisting == undefined) {
      switch (operation) {
        case 'upsert':
          try {
            await this.chatbotApiService.createChatbotSettings(
              metadata,
              entity.courseId,
              '',
            );
            return;
          } catch (exception) {
            if (
              exception instanceof HttpException &&
              exception.getStatus() == 500
            ) {
              // Chatbot server failed to connect or had an error, do what we gotta do
              await this.chatbotDataSource.query(
                'INSERT INTO course_setting ("pageContent","metadata") VALUES ($1,$2)',
                [String(entity.courseId), JSON.stringify(metadata)],
              );
            }
          }
      }
    } else {
      switch (operation) {
        case 'upsert':
          try {
            await this.chatbotApiService.updateChatbotSettings(
              metadata,
              entity.courseId,
              '',
            );
            return;
          } catch (exception) {
            if (
              exception instanceof HttpException &&
              exception.getStatus() == 500
            ) {
              // Chatbot server failed to connect or had an error, do what we gotta do
              await this.chatbotDataSource.query(
                'UPDATE course_setting SET "metadata" = $1 WHERE "pageContent" = $2',
                [JSON.stringify(metadata), String(entity.courseId)],
              );
            }
            return;
          }
        case 'remove':
          try {
            await this.chatbotApiService.deleteChatbotSettings(
              entity.courseId,
              '',
            );
            return;
          } catch (exception) {
            if (
              exception instanceof HttpException &&
              exception.getStatus() == 500
            ) {
              // Chatbot server failed to connect or had an error, do what we gotta do
              await this.chatbotDataSource.query(
                'DELETE FROM course_setting WHERE "pageContent" = $1',
                [String(entity.courseId)],
              );
            }
            return;
          }
      }
    }
  }

  private async metadataifyCourseSetting(
    courseSettings: CourseChatbotSettingsModel,
  ): Promise<ChatbotSettingsMetadata> {
    const defaultProps =
      courseSettings.organizationSettings.transformDefaults();
    const courseProps = pick(courseSettings, [
      'prompt',
      'temperature',
      'topK',
      'similarityThresholdDocuments',
      'similarityThresholdQuestions',
    ]);

    return {
      model: {
        type: courseSettings.llmModel.provider.providerType,
        headers: courseSettings.llmModel.provider.headers,
        defaultModelName:
          courseSettings.llmModel.provider.defaultModel.modelName,
        defaultVisionModelName:
          courseSettings.llmModel.provider.defaultVisionModel.modelName,
        baseUrl: courseSettings.llmModel.provider.baseUrl,
        modelName: courseSettings.llmModel.modelName,
      },
      ...{
        ...defaultProps,
        ...courseProps,
      },
    };
  }
}
