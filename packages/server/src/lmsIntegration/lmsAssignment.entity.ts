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

@Entity('lms_assignment_model')
export class LMSAssignmentModel extends BaseEntity {
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
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'timestamp', nullable: true })
  due?: Date;

  @Column({ type: 'timestamp' })
  modified: Date;

  @Column({ type: 'text', nullable: true })
  chatbotDocumentId: string;

  @Column({ type: 'text', array: true, default: [] })
  chatbotDocumentIds: string[];

  @Column({ type: 'timestamp', nullable: true })
  uploaded: Date;

  @Column({ type: 'boolean', default: true })
  syncEnabled: boolean;

  @ManyToOne(
    (type) => LMSCourseIntegrationModel,
    (integration) => integration.assignments,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'courseId', referencedColumnName: 'courseId' })
  course: LMSCourseIntegrationModel;
}
