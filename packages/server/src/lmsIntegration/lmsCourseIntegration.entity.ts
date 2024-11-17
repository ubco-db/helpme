import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { CourseModel } from '../course/course.entity';
import { LMSAssignmentModel } from './lmsAssignment.entity';

@Entity('lms_course_integration_model')
export class LMSCourseIntegrationModel extends BaseEntity {
  @PrimaryColumn()
  courseId: number;

  @Column({ type: 'text' })
  apiCourseId: string;

  @Column({ type: 'text' })
  apiKey: string;

  @Column({ type: 'timestamp' })
  apiKeyExpiry: Date;

  @ManyToOne(
    (type) => LMSOrganizationIntegrationModel,
    (integration) => integration.courseIntegrations,
  )
  orgIntegration: LMSOrganizationIntegrationModel;

  @OneToOne((type) => CourseModel, (course) => course.lmsIntegration)
  course: CourseModel;

  @OneToMany((type) => LMSAssignmentModel, (assignment) => assignment.course)
  @JoinColumn({ referencedColumnName: 'courseId' })
  assignments: LMSAssignmentModel[];
}
