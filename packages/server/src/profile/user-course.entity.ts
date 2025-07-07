import { Role } from '@koh/common';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { UserModel } from './user.entity';
import { InsightDashboardModel } from '../insights/dashboard.entity';

@Entity('user_course_model')
export class UserCourseModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((type) => UserModel, (user) => user.courses)
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  @Column({ nullable: true })
  userId: number;

  @ManyToOne((type) => CourseModel, (course) => course.userCourses)
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @Column({ nullable: true })
  courseId: number;

  @Column({ type: 'enum', enum: Role, default: Role.STUDENT })
  role: Role;

  // If this expires
  @Column({ nullable: true, default: false })
  expires: boolean;

  @OneToMany(
    (type) => InsightDashboardModel,
    (insightDashboard) => insightDashboard.userCourse,
  )
  insightDashboard?: InsightDashboardModel[];

  /* This represents the notes that professors can put on their TA's profiles*/
  @Column({ type: 'text', nullable: true })
  TANotes: string;

  @Column({ nullable: true, default: true })
  favourited: boolean;
}
