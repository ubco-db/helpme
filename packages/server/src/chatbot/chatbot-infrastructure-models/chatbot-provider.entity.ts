import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationChatbotSettingsModel } from './organization-chatbot-settings.entity';
import { LLMTypeModel } from './llm-type.entity';
import {
  ChatbotAllowedHeaders,
  ChatbotProviderResponse,
  ChatbotServiceProvider,
} from '@koh/common';
import { Exclude } from 'class-transformer';

@Entity('chatbot_provider_model')
export class ChatbotProviderModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  orgChatbotSettingsId: number;

  @Column({ type: 'text', nullable: true })
  nickname?: string;

  @Column({ type: 'enum', enum: ChatbotServiceProvider })
  providerType: ChatbotServiceProvider;

  @ManyToOne(
    (type) => OrganizationChatbotSettingsModel,
    (org) => org.providers,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'orgChatbotSettingsId' })
  organizationChatbotSettings: OrganizationChatbotSettingsModel;

  @Column({ type: 'text', nullable: true })
  baseUrl?: string;

  @Exclude()
  @Column({ type: 'text', nullable: true })
  apiKey?: string;

  @Column({
    generatedType: 'STORED',
    asExpression: `"apiKey" IS NOT NULL`,
  })
  hasApiKey: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  headers: ChatbotAllowedHeaders;

  @OneToMany((type) => LLMTypeModel, (llm) => llm.provider, {
    onDelete: 'CASCADE',
  })
  availableModels: LLMTypeModel[];

  @Column({ type: 'int', nullable: true })
  defaultModelId: number;

  @OneToOne((type) => LLMTypeModel, (llm) => llm.provider, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'defaultModelId' })
  defaultModel: LLMTypeModel;

  @Column({ type: 'int', nullable: true })
  defaultVisionModelId: number;

  @OneToOne((type) => LLMTypeModel, (llm) => llm.provider, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'defaultVisionModelId' })
  defaultVisionModel: LLMTypeModel;

  @Column({ type: 'text', array: true, nullable: false, default: [] })
  additionalNotes: string[] = [];

  getMetadata(): ChatbotProviderResponse {
    return <any>{
      type: this.providerType,
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      defaultModelName: this.defaultModel?.modelName,
      defaultVisionModelName: this.defaultVisionModel?.modelName,
      headers: this.headers,
    };
  }
}
