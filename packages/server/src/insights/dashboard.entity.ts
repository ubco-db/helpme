import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { UserCourseModel } from '../profile/user-course.entity';
import { InsightDetail } from '@koh/common';

@Entity('insight_dashboard_model')
@Unique('dashboardKey', ['name', 'userCourseId'])
export class InsightDashboardModel extends BaseEntity {
  // CourseSettings existence is dependent on the existence of a course
  @PrimaryColumn()
  userCourseId: number;

  @Column({ type: 'text' })
  name: string;

  @ManyToOne(
    (type) => UserCourseModel,
    (userCourse) => userCourse.insightDashboard,
    {
      onDelete: 'CASCADE',
    },
  )
  userCourse: UserCourseModel;

  @Column({ type: 'simple-json', default: {} })
  insights: InsightDetail;
}
