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
import { LMSQuizModel } from './lmsQuiz.entity';
import { LMSResourceType } from '@koh/common';

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

  @Column({ type: 'boolean', default: false })
  moduleLinkedPagesOnly: boolean;

  @OneToMany((type) => LMSFileModel, (file) => file.course)
  files: LMSFileModel[];

  @OneToMany((type) => LMSQuizModel, (quiz) => quiz.course)
  quizzes: LMSQuizModel[];
}
