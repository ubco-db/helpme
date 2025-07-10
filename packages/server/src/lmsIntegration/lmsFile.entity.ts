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

@Entity('lms_file_model')
export class LMSFileModel extends BaseEntity {
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

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  contentType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ type: 'timestamp' })
  modified: Date;

  @Column({ type: 'text', nullable: true })
  chatbotDocumentId: string;

  @Column({ type: 'timestamp', nullable: true })
  uploaded: Date;

  @Column({ type: 'boolean', default: true })
  syncEnabled: boolean;

  // Parent context for linking back to assignments/announcements
  @Column({ type: 'text', nullable: true })
  parentType?: 'assignment' | 'announcement' | 'standalone';

  @Column({ type: 'integer', nullable: true })
  parentId?: number;

  @Column({ type: 'text', nullable: true })
  parentName?: string;

  @ManyToOne(
    (type) => LMSCourseIntegrationModel,
    (integration) => integration.files,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'courseId', referencedColumnName: 'courseId' })
  course: LMSCourseIntegrationModel;
}
