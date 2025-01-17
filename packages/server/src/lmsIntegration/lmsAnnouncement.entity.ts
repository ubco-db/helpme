import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';

@Entity('lms_announcement_model')
export class LMSAnnouncementModel extends BaseEntity {
  @PrimaryColumn()
  id: number;

  @PrimaryColumn()
  courseId: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'timestamp' })
  posted: Date;

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
