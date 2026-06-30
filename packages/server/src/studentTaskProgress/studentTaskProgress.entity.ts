import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserModel } from '../profile/user.entity';
import { CourseModel } from '../course/course.entity';
import { StudentTaskProgress } from '@koh/common';

@Entity('student_task_progress_model')
export class StudentTaskProgressModel extends BaseEntity {
  @Column({ type: 'json', nullable: true }) // todo: maybe migrate this to jsonb for better querying?
  taskProgress: StudentTaskProgress; // this is the main item that this entity stores

  @PrimaryColumn() // two primary columns are needed to make the composite primary key (each studentTaskProgress is uniquely defined by each [cid, uid] combo)
  uid: number;

  @ManyToOne(() => UserModel, (user) => user.taskProgress, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'uid' })
  user: UserModel;

  @PrimaryColumn()
  cid: number;

  @ManyToOne(() => CourseModel, (course) => course.taskProgresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cid' })
  course: CourseModel;
}
