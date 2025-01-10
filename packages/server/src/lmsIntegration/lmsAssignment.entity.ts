import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';

@Entity('lms_assignment_model')
export class LMSAssignmentModel extends BaseEntity {
  @PrimaryColumn()
  id: number;

  @PrimaryColumn()
  courseId: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'timestamp' })
  due: Date;

  @Column({ type: 'timestamp' })
  modified: Date;

  @Column({ type: 'timestamp' })
  trackedAt: Date;

  @Column({ type: 'string', nullable: true })
  chatbotDocumentId: string;

  @ManyToOne(
    (type) => LMSCourseIntegrationModel,
    (integration) => integration.assignments,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'courseId', referencedColumnName: 'id' })
  course: LMSCourseIntegrationModel;
}
