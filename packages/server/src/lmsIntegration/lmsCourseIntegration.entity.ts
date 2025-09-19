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
import { LMSAccessTokenModel } from './lms-access-token.entity';

@Entity('lms_course_integration_model')
export class LMSCourseIntegrationModel extends BaseEntity {
  @PrimaryColumn()
  courseId: number;

  @Column({ type: 'text' })
  apiCourseId: string;

  @Column({ type: 'integer', nullable: true })
  accessTokenId?: number;

  @Column({ type: 'text', nullable: true })
  apiKey?: string;

  @Column({ type: 'timestamp', nullable: true })
  apiKeyExpiry?: Date;

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
    () => LMSOrganizationIntegrationModel,
    (integration) => integration.courseIntegrations,
    { onDelete: 'CASCADE' },
  )
  orgIntegration: LMSOrganizationIntegrationModel;

  @OneToOne(() => CourseModel, (course) => course.lmsIntegration)
  @JoinColumn({ name: 'courseId', referencedColumnName: 'id' })
  course: CourseModel;

  @OneToMany(() => LMSAssignmentModel, (assignment) => assignment.course)
  assignments: LMSAssignmentModel[];

  @OneToMany(() => LMSAnnouncementModel, (announcement) => announcement.course)
  announcements: LMSAnnouncementModel[];

  @OneToMany(() => LMSPageModel, (page) => page.course)
  pages: LMSPageModel[];

  @OneToMany(() => LMSFileModel, (file) => file.course)
  files: LMSFileModel[];

  @ManyToOne(() => LMSAccessTokenModel, (token) => token.courses, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'accessTokenId' })
  accessToken?: LMSAccessTokenModel;
}
