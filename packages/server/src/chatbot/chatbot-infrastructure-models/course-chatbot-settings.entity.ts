import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from '../../course/course.entity';
import { OrganizationChatbotSettingsModel } from './organization-chatbot-settings.entity';
import { LLMTypeModel } from './llm-type.entity';

@Entity('course_chatbot_settings_model')
export class CourseChatbotSettingsModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  courseId: number;

  @OneToOne((type) => CourseModel, (course) => course.chatbotSettings)
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @Column({ type: 'int', nullable: false })
  organizationSettingsId: number;

  @ManyToOne(
    (type) => OrganizationChatbotSettingsModel,
    (org) => org.courseSettingsInstances,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'organizationSettingsId' })
  organizationSettings: OrganizationChatbotSettingsModel;

  @Column({ type: 'int', nullable: false })
  llmId: number;

  @ManyToOne((type) => LLMTypeModel, (llm) => llm.courses)
  @JoinColumn({ name: 'llmId' })
  llmModel: LLMTypeModel;

  @Column({
    type: 'text',
    nullable: false,
    default: `You are a course help assistant for a course. Here are some rules for question answering:  1) You may use markdown for styling your answers. 2) Refer to context when you see fit. 3) Try not giving the assignment question answers directly to students, instead provide hints.`,
  })
  prompt: string;

  @Column({ type: 'double precision', nullable: false, default: 0.7 })
  temperature: number;

  @Column({ type: 'double precision', nullable: false, default: 5 })
  topK: number;

  @Column({ type: 'double precision', nullable: false, default: 0.55 })
  similarityThresholdDocuments: number;

  @Column({ type: 'double precision', nullable: false, default: 0.9 })
  similarityThresholdQuestions: number;
}
