import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
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
  @JoinColumn({ name: 'userCourseId' })
  userCourse: UserCourseModel;

  @Column({ nullable: true })
  userCourseId: number;

  @ManyToOne(
    (type) => AsyncQuestionModel,
    (asyncQuestion) => asyncQuestion.viewers,
  )
  @JoinColumn({ name: 'asyncQuestionId' })
  asyncQuestion: AsyncQuestionModel;

  @Column({ nullable: true })
  asyncQuestionId: number;

  @Column({ type: 'boolean', default: true })
  readLatest: boolean;
}
