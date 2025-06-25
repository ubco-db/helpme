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
import { LMSAnnouncementModel } from './lmsAnnouncement.entity';
import { LMSPageModel } from './lmsPage.entity';

@Entity('lms_course_integration_model')
export class LMSCourseIntegrationModel extends BaseEntity {
  @PrimaryColumn()
  courseId: number;

  @Column({ type: 'text' })
  apiCourseId: string;

  @Column({ type: 'text' })
  apiKey: string;

  @Column({ type: 'timestamp', nullable: true })
  apiKeyExpiry: Date;

  @Column({ type: 'boolean', default: false })
  lmsSynchronize: boolean;

  @ManyToOne(
    (type) => LMSOrganizationIntegrationModel,
    (integration) => integration.courseIntegrations,
    { onDelete: 'CASCADE' },
  )
  orgIntegration: LMSOrganizationIntegrationModel;

  @OneToOne((type) => CourseModel, (course) => course.lmsIntegration)
  @JoinColumn({ name: 'courseId', referencedColumnName: 'id' })
  course: CourseModel;

  @OneToMany((type) => LMSAssignmentModel, (assignment) => assignment.course)
  assignments: LMSAssignmentModel[];

  @OneToMany(
    (type) => LMSAnnouncementModel,
    (announcement) => announcement.course,
  )
  announcements: LMSAnnouncementModel[];

  @OneToMany((type) => LMSPageModel, (page) => page.course)
  pages: LMSPageModel[];
}
