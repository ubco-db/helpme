import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  FindOptionsRelations,
  FindOptionsWhere,
  In,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { CourseChatbotSettingsModel } from './course-chatbot-settings.entity';
import { ChatbotApiService } from '../chatbot-api.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { HttpException } from '@nestjs/common';
import { LLMTypeModel } from './llm-type.entity';
import { ChatbotProviderModel } from './chatbot-provider.entity';
import { OrganizationChatbotSettingsModel } from './organization-chatbot-settings.entity';
import { ChatbotDataSourceService } from '../chatbot-datasource/chatbot-datasource.service';

const afterInsertWatch = [CourseChatbotSettingsModel.name];
const afterUpdateWatch = [
  CourseChatbotSettingsModel.name,
  OrganizationChatbotSettingsModel.name,
  LLMTypeModel.name,
  ChatbotProviderModel.name,
];
const beforeUpdateWatch = [
  OrganizationChatbotSettingsModel.name,
  ChatbotProviderModel.name,
];

@EventSubscriber()
export class ChatbotSettingsSubscriber implements EntitySubscriberInterface {
  constructor(
    dataSource: DataSource,
    private chatbotApiService: ChatbotApiService,
    private chatbotDataSourceService: ChatbotDataSourceService,
  ) {
    dataSource.subscribers.push(this);
  }

  async afterInsert(event: InsertEvent<any>): Promise<void> {
    if (afterInsertWatch.some((t) => event.metadata?.name == t)) {
      await this.afterUpsert(event);
    }
  }

  async afterUpdate(event: UpdateEvent<any>): Promise<void> {
    if (afterUpdateWatch.some((t) => event.metadata?.name == t)) {
      await this.afterUpsert(event);
    }
  }

  async beforeUpdate(event: UpdateEvent<any>) {
    const typeMatch = beforeUpdateWatch.find((t) => event.metadata?.name == t);

    if (typeMatch && 'id' in event.entity) {
      const current = await event.manager.findOne(typeMatch, {
        where: { id: event.entity.id },
      });
      if (!current) {
        return;
      }
      const { where } = this.getFindOptions(event.entity);

      if (current instanceof OrganizationChatbotSettingsModel) {
        const entity = current as unknown as OrganizationChatbotSettingsModel;
        const updatedDefaultColumns = Object.keys(event.entity)
          .filter((u) => u.startsWith('default_') || u == 'defaultProviderId')
          .filter((u) => entity[u] !== event.entity[u]);

        const toUpdateFull: {
          entityId: number;
          props: Partial<CourseChatbotSettingsModel>;
        }[] = [];

        const courseDefaults = CourseChatbotSettingsModel.getDefaults(
          event.manager,
        );
        await Promise.all(
          updatedDefaultColumns.map(async (column) => {
            const propertyName = column.substring('default_'.length);
            const usingPropertyName = column.startsWith('default_')
              ? 'usingDefault' +
                propertyName.charAt(0).toUpperCase() +
                propertyName.substring(1)
              : 'usingDefaultModel';

            let propValue = event.entity[column];

            if (column == 'defaultProviderId') {
              const provider = await event.manager.findOne(
                ChatbotProviderModel,
                {
                  where: { id: event.entity[column] },
                },
              );
              propValue = provider?.defaultModelId;
            }

            if (
              usingPropertyName == 'usingDefaultModel' &&
              propValue == undefined
            ) {
              return;
            } else if (propValue == undefined) {
              propValue = courseDefaults[propertyName];
            }

            const props =
              usingPropertyName == 'usingDefaultModel'
                ? { llmId: propValue }
                : { [propertyName]: propValue };

            const found = await event.manager.find(CourseChatbotSettingsModel, {
              where: { ...where, [usingPropertyName]: true },
              select: { id: true },
            });

            toUpdateFull.push(...found.map((f) => ({ entityId: f.id, props })));
          }),
        );
        const toUpdateCollapsed: {
          entityId: number;
          props: Partial<CourseChatbotSettingsModel>;
        }[] = toUpdateFull
          .filter(
            (v0, i, a) => a.findIndex((v1) => v0.entityId == v1.entityId) == i,
          )
          .map((toUpdate) => {
            const entries = toUpdateFull.filter(
              (v) => v.entityId == toUpdate.entityId,
            );
            let props = {};
            entries.forEach((entry) => (props = { ...props, ...entry.props }));
            return {
              entityId: toUpdate.entityId,
              props,
            };
          });
        const toUpdateGrouped: {
          entityIds: number[];
          props: Partial<CourseChatbotSettingsModel>;
        }[] = toUpdateCollapsed
          .filter(
            (v0, i, a) =>
              a.findIndex(
                (v1) =>
                  JSON.stringify(Object.keys(v1.props)) ==
                  JSON.stringify(Object.keys(v0.props)),
              ) == i,
          )
          .map((toUpdate) => {
            const keys = JSON.stringify(Object.keys(toUpdate.props));
            const entries = toUpdateCollapsed.filter(
              (v) => JSON.stringify(Object.keys(v.props)) == keys,
            );
            return {
              entityIds: entries.map((i) => i.entityId),
              props: toUpdate.props,
            };
          });
        try {
          await event.queryRunner.connect();
          await event.queryRunner.startTransaction();
          await Promise.all(
            toUpdateGrouped.map(
              async (toUpdate) =>
                await event.queryRunner.manager.update(
                  CourseChatbotSettingsModel,
                  {
                    id: In(toUpdate.entityIds),
                  },
                  {
                    ...toUpdate.props,
                  },
                ),
            ),
          );
          await event.queryRunner.commitTransaction();
        } catch (err) {
          if (event.queryRunner.isTransactionActive) {
            await event.queryRunner.rollbackTransaction();
          }
          throw err;
        }
        return;
      } else if (current instanceof ChatbotProviderModel) {
        const entity = current as unknown as ChatbotProviderModel;
        const updatedDefaultModel = Object.keys(event.entity).find(
          (u) => u == 'defaultModelId',
        );
        if (!entity.defaultModelId) return;

        if (updatedDefaultModel) {
          try {
            await event.queryRunner.connect();
            await event.queryRunner.startTransaction();
            await event.queryRunner.manager.update(
              CourseChatbotSettingsModel,
              {
                ...where,
                llmId: entity.defaultModelId,
                usingDefaultModel: true,
              },
              {
                llmId: event.entity.defaultModelId,
              },
            );
            await event.queryRunner.commitTransaction();
          } catch (err) {
            if (event.queryRunner.isTransactionActive) {
              await event.queryRunner.rollbackTransaction();
            }
            throw err;
          }
        }
        return;
      }
    }
  }

  async afterUpsert(event: UpdateEvent<any> | InsertEvent<any>): Promise<void> {
    // upsert corresponding table entry in chatbot db

    const toUpdate: CourseChatbotSettingsModel[] = [];

    const { where, relations } = this.getFindOptions(event.entity);
    toUpdate.push(
      ...(await event.manager.find(CourseChatbotSettingsModel, {
        where,
        relations,
      })),
    );

    await Promise.allSettled(
      toUpdate.map(async (courseChatbotSettings) => {
        const findExisting = await this.getChatbotEntry(
          courseChatbotSettings.courseId,
        );
        if (
          !findExisting ||
          JSON.stringify(findExisting?.metadata ?? {}) !==
            JSON.stringify(courseChatbotSettings.getMetadata())
        ) {
          this.updateChatbotRepository(
            courseChatbotSettings,
            'upsert',
            findExisting,
          ).then();
        }
      }),
    );
  }

  private getFindOptions(
    entity: any,
    setRelations?: FindOptionsRelations<CourseChatbotSettingsModel>,
  ): {
    where: FindOptionsWhere<CourseChatbotSettingsModel>;
    relations: FindOptionsRelations<CourseChatbotSettingsModel>;
  } {
    const relations: FindOptionsRelations<CourseChatbotSettingsModel> = {
      organizationSettings: {
        defaultProvider: {
          defaultModel: true,
          defaultVisionModel: true,
        },
      },
      llmModel: {
        provider: {
          defaultModel: true,
          defaultVisionModel: true,
        },
      },
      ...setRelations,
    };
    if (entity instanceof CourseChatbotSettingsModel) {
      return {
        where: { id: entity.id },
        relations,
      };
    } else if (entity instanceof LLMTypeModel) {
      return {
        where: { llmId: entity.id },
        relations,
      };
    } else if (entity instanceof ChatbotProviderModel) {
      return {
        where: { llmModel: { providerId: entity.id } },
        relations,
      };
    } else if (entity instanceof OrganizationChatbotSettingsModel) {
      return {
        where: { organizationSettingsId: entity.id },
        relations,
      };
    }
    return {
      where: {},
      relations,
    };
  }

  async updateChatbotRepository(
    entity: CourseChatbotSettingsModel,
    operation: 'upsert' | 'remove',
    findExisting?: CourseChatbotSettingsModel,
  ): Promise<void> {
    const dataSource = await this.chatbotDataSourceService.getDataSource();
    const qry = dataSource.createQueryRunner();
    await qry.connect();
    try {
      const metadata = entity.getMetadata();
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
                await qry.query(
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
                await qry.query(
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
                await qry.query(
                  'DELETE FROM course_setting WHERE "pageContent" = $1',
                  [String(entity.courseId)],
                );
              }
              return;
            }
        }
      }
    } catch (err) {
      console.error(`Failed to update Chatbot repository: ${err}`);
    } finally {
      await qry.release();
    }
  }

  private async getChatbotEntry(courseId: number) {
    const dataSource = await this.chatbotDataSourceService.getDataSource();
    const qry = dataSource.createQueryRunner();
    await qry.connect();
    try {
      return (
        await qry.query(
          'SELECT * FROM course_setting WHERE "pageContent" = $1',
          [String(courseId)],
        )
      )[0];
    } catch (err) {
      return undefined;
    } finally {
      await qry.release();
    }
  }
}
