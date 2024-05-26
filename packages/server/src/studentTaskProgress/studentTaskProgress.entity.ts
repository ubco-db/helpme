import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { QueueModel } from '../queue/queue.entity';
import { UserModel } from 'profile/user.entity';

@Entity('student_task_progress_model')
export class StudentTaskProgress extends BaseEntity {
  @Column({ type: 'json' })
  taskProgress: object;

  @PrimaryColumn()
  @ManyToOne(() => UserModel)
  @JoinColumn({ name: 'uid' })
  user: UserModel;

  @PrimaryColumn()
  @ManyToOne(() => QueueModel)
  @JoinColumn({ name: 'qid' })
  queue: QueueModel;
}
