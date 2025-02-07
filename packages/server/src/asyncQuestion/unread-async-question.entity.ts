import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { AsyncQuestionModel } from './asyncQuestion.entity';
import { UserModel } from 'profile/user.entity';
import { Exclude } from 'class-transformer';
import { CourseModel } from 'course/course.entity';

@Entity('unread_async_question_model')
export class UnreadAsyncQuestionModel extends BaseEntity {
  /* Technically not needed since asyncQuestions have a courseId, but this makes a bunch of queries easier and still kinda makes sense */
  @ManyToOne((type) => CourseModel, (course) => course.unreadAsyncQuestions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;

  @PrimaryColumn()
  courseId: number;

  @ManyToOne((type) => UserModel, (user) => user.unreadAsyncQuestions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  @Exclude()
  user: UserModel;

  @PrimaryColumn()
  userId: number;

  @ManyToOne(
    (type) => AsyncQuestionModel,
    (asyncQuestion) => asyncQuestion.viewers,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'asyncQuestionId' })
  @Exclude()
  asyncQuestion: AsyncQuestionModel;

  @PrimaryColumn()
  asyncQuestionId: number;

  @Column({ type: 'boolean', default: true })
  readLatest: boolean;
}
