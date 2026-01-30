import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatbotProviderModel } from './chatbot-provider.entity';
import { OrganizationModel } from '../../organization/organization.entity';
import { CourseChatbotSettingsModel } from './course-chatbot-settings.entity';
import { pick } from 'lodash';
import { ChatbotOrganizationSettings } from '@koh/common';

@Entity('organization_chatbot_settings_model')
export class OrganizationChatbotSettingsModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  organizationId: number;

  @OneToOne((type) => OrganizationModel, (org) => org.chatbotSettings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationModel;

  @OneToMany(
    (type) => ChatbotProviderModel,
    (provider) => provider.organizationChatbotSettings,
  )
  providers: ChatbotProviderModel[];

  @OneToMany(
    (type) => CourseChatbotSettingsModel,
    (courseChatbotSettings) => courseChatbotSettings.organizationSettings,
  )
  courseSettingsInstances: CourseChatbotSettingsModel[];

  @Column({ type: 'int', nullable: true })
  defaultProviderId: number;

  @OneToOne(
    (type) => ChatbotProviderModel,
    (provider) => provider.organizationChatbotSettings,
    { onDelete: 'SET NULL' },
  )
  @JoinColumn({ name: 'defaultProviderId' })
  defaultProvider: ChatbotProviderModel;

  @Column({ type: 'text', nullable: true })
  default_prompt?: string;

  @Column({ type: 'double precision', nullable: true })
  default_temperature?: number;

  @Column({ type: 'double precision', nullable: true })
  default_topK?: number;

  @Column({ type: 'double precision', nullable: true })
  default_similarityThresholdDocuments?: number;

  @Column({ type: 'double precision', nullable: true })
  default_similarityThresholdQuestions?: number;

  transformDefaults() {
    const defaultProps = pick(this, [
      'defaultProviderId',
      'default_prompt',
      'default_temperature',
      'default_topK',
      'default_similarityThresholdDocuments',
      'default_similarityThresholdQuestions',
    ]);

    const mappedDefaultProps: Record<string, any> = {};
    Object.keys(defaultProps).forEach((key) => {
      if (defaultProps[key] != undefined) {
        if (key == 'defaultProviderId') {
          mappedDefaultProps['llmId'] = this.defaultProvider?.defaultModelId;
        } else if (key != 'defaultProviderId') {
          mappedDefaultProps[key.substring('default_'.length)] =
            defaultProps[key];
        }
      }
    });
    return mappedDefaultProps;
  }

  getMetadata(): ChatbotOrganizationSettings {
    return {
      defaultProvider: this.defaultProvider?.getMetadata(),
    };
  }
}
