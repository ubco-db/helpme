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
import { ChatbotSettingsMetadata, dropUndefined } from '@koh/common';
import { pick } from 'lodash';

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
    type: 'boolean',
    nullable: false,
    default: false,
  })
  usingDefaultModel: boolean;

  @Column({
    type: 'text',
    nullable: false,
    default: `You are a course help assistant for a course. Here are some rules for question answering:  1) You may use markdown for styling your answers. 2) Refer to context when you see fit. 3) Try not giving the assignment question answers directly to students, instead provide hints.`,
  })
  prompt: string;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false,
  })
  usingDefaultPrompt: boolean;

  @Column({ type: 'double precision', nullable: false, default: 0.7 })
  temperature: number;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false,
  })
  usingDefaultTemperature: boolean;

  @Column({ type: 'double precision', nullable: false, default: 5 })
  topK: number;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false,
  })
  usingDefaultTopK: boolean;

  @Column({ type: 'double precision', nullable: false, default: 0.55 })
  similarityThresholdDocuments: number;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false,
  })
  usingDefaultSimilarityThresholdDocuments: boolean;

  @Column({ type: 'double precision', nullable: false, default: 0.9 })
  similarityThresholdQuestions: number;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false,
  })
  usingDefaultSimilarityThresholdQuestions: boolean;

  getMetadata(): ChatbotSettingsMetadata {
    const defaults = this.organizationSettings.transformDefaults();
    const courseDefaults = CourseChatbotSettingsModel.getDefaults();
    const props = pick(this, [
      'prompt',
      'temperature',
      'topK',
      'similarityThresholdDocuments',
      'similarityThresholdQuestions',
    ]);
    return {
      organizationSettings: this.organizationSettings.getMetadata(),
      model: this.llmModel.getMetadata(),
      modelName: this.llmModel.modelName,
      ...{
        ...courseDefaults,
        ...dropUndefined(defaults),
        ...dropUndefined(props),
      },
    };
  }

  static getDefaults() {
    const defaultKeys = this.getUsingDefaultsKeys().map(
      (key) =>
        key
          .substring('usingDefault'.length, 'usingDefault'.length + 1)
          .toLowerCase() + key.substring('usingDefault'.length + 1),
    );

    const columnMetadata =
      CourseChatbotSettingsModel.getRepository().manager.connection.getMetadata(
        CourseChatbotSettingsModel,
      );
    const defaults: Record<string, any> = {};
    columnMetadata.columns.forEach((col) => {
      defaults[col.propertyName] = col.default;
    });
    Object.keys(defaults).forEach((key0) => {
      if (!defaultKeys.some((key1) => key0 == key1)) {
        delete defaults[key0];
      }
    });
    return defaults;
  }

  static getPopulatedUsingDefaults(
    initialValueOrValues: boolean | Record<string, boolean> = false,
  ): Record<string, boolean> {
    const values: Record<string, boolean> = {};
    CourseChatbotSettingsModel.getUsingDefaultsKeys().forEach((key: string) => {
      if (
        typeof initialValueOrValues == 'object' &&
        initialValueOrValues[key] != undefined
      ) {
        values[key] = initialValueOrValues[key];
      } else {
        values[key] = !(typeof initialValueOrValues == 'object')
          ? initialValueOrValues
          : false;
      }
    });
    return values;
  }

  static getUsingDefaultsKeys(): string[] {
    const metadata =
      CourseChatbotSettingsModel.getRepository()?.manager?.connection?.getMetadata(
        CourseChatbotSettingsModel,
      );
    return (
      metadata?.columns
        ?.map((s) => s.propertyName)
        .filter((s) => s.startsWith('usingDefault')) ?? []
    );
  }
}
