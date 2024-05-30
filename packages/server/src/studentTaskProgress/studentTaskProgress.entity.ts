import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserModel } from 'profile/user.entity';
import { CourseModel } from 'course/course.entity';

/*
Basically stores this:

{
  "lab1": {
      "task1": {
          "isDone": true
      },
      "task2": {
          "isDone": false
      },
      "task3": {
          "isDone": false
      }
  },
  "lab2": {
      "task1": {
          "isDone": false
      },
      "task2": {
          "isDone": false
      }
  }
}
*/

@Entity('student_task_progress_model')
export class StudentTaskProgressModel extends BaseEntity {
  @Column({ type: 'json' })
  taskProgress: object;

  @PrimaryColumn()
  @ManyToOne(() => UserModel)
  @JoinColumn({ name: 'uid' })
  user: UserModel;

  @PrimaryColumn()
  @ManyToOne(() => CourseModel)
  @JoinColumn({ name: 'cid' })
  course: CourseModel;
}
