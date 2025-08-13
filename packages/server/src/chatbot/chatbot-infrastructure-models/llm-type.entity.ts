import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  VirtualColumn,
} from 'typeorm';
import { CourseChatbotSettingsModel } from './course-chatbot-settings.entity';
import { ChatbotProviderModel } from './chatbot-provider.entity';
import { ModelMetadata } from '@koh/common';

@Entity('llm_type_model')
export class LLMTypeModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: false })
  modelName: string;

  @Column({ type: 'boolean', nullable: false, default: false })
  isRecommended: boolean;

  @Column({ type: 'boolean', nullable: false, default: true })
  isText: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  isVision: boolean;

  @Column({ type: 'boolean', nullable: false })
  isThinking: boolean;

  @Column({ type: 'int' })
  providerId: number;

  @ManyToOne(
    (type) => ChatbotProviderModel,
    (provider) => provider.availableModels,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'providerId' })
  provider: ChatbotProviderModel;

  @Column({ type: 'text', array: true, nullable: false, default: [] })
  additionalNotes: string[] = [];

  @OneToMany((type) => CourseChatbotSettingsModel, (course) => course.llmModel)
  courses: CourseChatbotSettingsModel[];

  @VirtualColumn({
    type: 'text',
    query: (alias: string) => `
    SELECT "additionalNotes" FROM "chatbot_provider_model" WHERE "id" = ${alias}."providerId"
  `,
  })
  providerNotes: string[] = [];

  getMetadata(): ModelMetadata {
    return {
      provider: this.provider.getMetadata(),
      modelName: this.modelName,
    };
  }
}
