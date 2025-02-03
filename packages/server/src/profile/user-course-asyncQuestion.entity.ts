import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { UserCourseModel } from './user-course.entity';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';

@Entity('user_course_async_model')
export class UserCourseAsyncQuestionModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    (type) => UserCourseModel,
    (userCourse) => userCourse.courseAsyncQuestions,
  )
  @JoinColumn({ name: 'userId' })
  userCourse: UserCourseModel;

  @Column({ nullable: true })
  userCourseId: number;

  @ManyToOne(
    (type) => AsyncQuestionModel,
    (asyncQuestion) => asyncQuestion.viewers,
  )
  @JoinColumn({ name: 'courseId' })
  asyncQuestion: CourseModel;

  @Column({ nullable: true })
  asyncQuestionId: number;

  @Column({ type: 'boolean', default: false })
  readLatest: boolean;
}
