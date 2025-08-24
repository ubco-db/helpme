import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { LMSIntegrationPlatform, LMSQuizAccessLevel } from '@koh/common';

@Entity('lms_quiz_model')
export class LMSQuizModel extends BaseEntity {
  @PrimaryColumn()
  id: number;

  @PrimaryColumn()
  courseId: number;

  // Would rather this be enum, but evolving enums are not well-supported...
  @Column({
    type: 'text',
  })
  lmsSource: LMSIntegrationPlatform;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp', nullable: true })
  due: Date;

  @Column({ type: 'timestamp', nullable: true })
  unlock: Date;

  @Column({ type: 'timestamp', nullable: true })
  lock: Date;

  @Column({ type: 'integer', nullable: true })
  timeLimit: number; // in minutes

  @Column({ type: 'integer', nullable: true })
  allowedAttempts: number;

  @Column({ type: 'jsonb', nullable: true })
  questions: any[]; // Store quiz questions as JSON

  @Column({ type: 'timestamp' })
  modified: Date;

  @Column({
    type: 'enum',
    enum: LMSQuizAccessLevel,
    default: LMSQuizAccessLevel.LOGISTICS_ONLY,
  })
  accessLevel: LMSQuizAccessLevel;

  @Column({ type: 'text', nullable: true })
  chatbotDocumentId: string;

  @Column({ type: 'timestamp', nullable: true })
  uploaded: Date;

  @Column({ type: 'boolean', default: true })
  syncEnabled: boolean;

  @ManyToOne(
    (type) => LMSCourseIntegrationModel,
    (integration) => integration.quizzes,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'courseId', referencedColumnName: 'courseId' })
  course: LMSCourseIntegrationModel;
}
