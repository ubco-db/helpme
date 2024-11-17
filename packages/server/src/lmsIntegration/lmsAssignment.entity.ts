import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';

@Entity('lms_assignment_model')
export class LMSAssignmentModel {
  @PrimaryColumn()
  id: number;

  @PrimaryColumn({ type: 'text' })
  courseId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'timestamp' })
  trackedAt: Date;

  @ManyToOne(
    (type) => LMSCourseIntegrationModel,
    (integration) => integration.assignments,
  )
  course: LMSCourseIntegrationModel;
}
