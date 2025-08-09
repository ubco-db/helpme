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
import { LMSFileModel } from './lmsFile.entity';
import { LMSResourceType } from '@koh/common';

@Entity('lms_course_integration_model')
export class LMSCourseIntegrationModel extends BaseEntity {
  @PrimaryColumn()
  courseId: number;

  @Column({ type: 'text' })
  apiCourseId: string;

  // STANDARD IMPL
  @Column({ type: 'text', nullable: true })
  apiKey?: string;

  @Column({ type: 'timestamp', nullable: true })
  apiKeyExpiry?: Date;

  // OAUTH-FLOW IMPL
  @Column({ type: 'text', nullable: true })
  apiToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  apiTokenAcquired?: Date;

  @Column({ type: 'integer', nullable: true, default: 3600000 })
  apiTokenTTL?: number; // MILLISECONDS

  @Column({ type: 'text', nullable: true })
  apiRefreshToken?: string;

  @Column({ type: 'boolean', default: false })
  apiTokenExpired?: false;

  @Column({ type: 'boolean', default: false })
  lmsSynchronize: boolean;

  @Column({
    type: 'enum',
    enum: LMSResourceType,
    array: true,
    default: [
      LMSResourceType.ASSIGNMENTS,
      LMSResourceType.ANNOUNCEMENTS,
      LMSResourceType.PAGES,
    ],
  })
  selectedResourceTypes: LMSResourceType[];

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

  @OneToMany((type) => LMSFileModel, (file) => file.course)
  files: LMSFileModel[];
}
