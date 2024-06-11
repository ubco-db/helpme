import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserModel } from '../profile/user.entity';
import { CourseModel } from './course.entity';
import { StudentTaskProgress } from '@koh/common';

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
  @Column({ type: 'json', nullable: true })
  taskProgress: StudentTaskProgress;

  @PrimaryColumn()
  uid: number;

  @ManyToOne(() => UserModel, (user) => user.taskProgress)
  @JoinColumn({ name: 'uid' })
  user: UserModel;

  @PrimaryColumn()
  cid: number;

  @ManyToOne(() => CourseModel, (course) => course.taskProgresses)
  @JoinColumn({ name: 'cid' })
  course: CourseModel;
}
