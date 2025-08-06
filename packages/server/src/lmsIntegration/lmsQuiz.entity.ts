import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { LMSIntegrationPlatform } from '@koh/common';

@Entity('lms_quiz_model')
export class LMSQuizModel extends BaseEntity {
  @PrimaryColumn()
  id: number;

  @PrimaryColumn()
  courseId: number;

  @Column({ type: 'text' })
  lmsSource: LMSIntegrationPlatform;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'text', default: '' })
  instructions: string;

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column({ type: 'integer', nullable: true })
  timeLimit?: number;

  @Column({ type: 'integer', default: 1 })
  allowedAttempts: number;

  @Column({ type: 'text', nullable: true })
  quizType: string;

  @Column({ type: 'text', default: 'LOGISTICS_ONLY' })
  accessLevel: string;

  @Column({ type: 'boolean', default: false })
  includeGeneralComments: boolean;

  @Column({ type: 'boolean', default: false })
  includeCorrectAnswerComments: boolean;

  @Column({ type: 'boolean', default: false })
  includeIncorrectAnswerComments: boolean;

  @Column({ type: 'jsonb', nullable: true })
  questionsData: any;

  @Column({ type: 'timestamp' })
  modified: Date;

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
