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

@Entity('lms_announcement_model')
export class LMSAnnouncementModel extends BaseEntity {
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
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'timestamp' })
  posted: Date;

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
    (integration) => integration.assignments,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'courseId', referencedColumnName: 'courseId' })
  course: LMSCourseIntegrationModel;
}
