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

  @Column({
    type: 'enum',
    enum: LMSIntegrationPlatform,
    enumName: 'lms_api_platform_enum',
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

  @Column({ type: 'text' })
  chatbotDocumentId: string;

  @Column({ type: 'timestamp' })
  uploaded: Date;

  @ManyToOne(
    (type) => LMSCourseIntegrationModel,
    (integration) => integration.assignments,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'courseId', referencedColumnName: 'courseId' })
  course: LMSCourseIntegrationModel;
}
