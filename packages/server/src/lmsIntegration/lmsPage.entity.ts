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

@Entity('lms_page_model')
export class LMSPageModel extends BaseEntity {
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
  body?: string;

  @Column({ type: 'text', nullable: true })
  url: string;

  @Column({ type: 'boolean', default: false })
  frontPage: boolean;

  @Column({ type: 'timestamp' })
  modified: Date;

  @Column({ type: 'text', nullable: true })
  chatbotDocumentId: string;

  @Column({ type: 'timestamp', nullable: true })
  uploaded: Date;

  @Column({ type: 'boolean', default: true })
  syncEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  isModuleLinked: boolean;

  @ManyToOne(
    (type) => LMSCourseIntegrationModel,
    (integration) => integration.pages,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'courseId', referencedColumnName: 'courseId' })
  course: LMSCourseIntegrationModel;
}
