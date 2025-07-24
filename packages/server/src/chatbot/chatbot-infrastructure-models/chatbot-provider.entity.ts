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
import { ChatbotAllowedHeaders, ChatbotServiceProvider } from '@koh/common';

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
}
