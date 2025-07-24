import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseChatbotSettingsModel } from './course-chatbot-settings.entity';
import { ChatbotProviderModel } from './chatbot-provider.entity';

@Entity('llm_type_model')
export class LLMTypeModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: false })
  modelName: string;

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

  @OneToMany((type) => CourseChatbotSettingsModel, (course) => course.llmModel)
  courses: CourseChatbotSettingsModel[];
}
