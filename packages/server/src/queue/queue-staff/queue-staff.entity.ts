import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { QueueModel } from '../queue.entity';
import { UserModel } from '../../profile/user.entity';
import { ExtraTAStatus } from '@koh/common';

@Entity('queue_staff_model')
export class QueueStaffModel extends BaseEntity {
  @PrimaryColumn('integer', { name: 'queueId' })
  queueId: number;

  @PrimaryColumn('integer', { name: 'userId' })
  userId: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  createdAt: Date;

  @ManyToOne(() => QueueModel, (queue) => queue.queueStaff, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'queueId' })
  queue: QueueModel;

  @ManyToOne(() => UserModel, (user) => user.queueStaff, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  // Optional extra status a TA can set for themselves (e.g., Away)
  @Column({
    type: 'enum',
    enum: ExtraTAStatus,
    nullable: true,
    name: 'extraTAStatus',
  })
  extraTAStatus: ExtraTAStatus | null;
}
