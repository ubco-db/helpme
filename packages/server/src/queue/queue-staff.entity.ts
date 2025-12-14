import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { QueueModel } from './queue.entity';
import { UserModel } from '../profile/user.entity';
import { ExtraTAStatus } from '@koh/common';

// Map the existing join table used by the ManyToMany relation between QueueModel.staffList and UserModel.queues
// This allows us to store additional metadata for a TA's status within a queue without refactoring all relations.
@Entity('queue_model_staff_list_user_model')
export class QueueStaffModel extends BaseEntity {
  @PrimaryColumn('int', { name: 'queueModelId' })
  queueModelId: number;

  @PrimaryColumn('int', { name: 'userModelId' })
  userModelId: number;

  @ManyToOne(() => QueueModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queueModelId' })
  queue: QueueModel;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userModelId' })
  user: UserModel;

  // Optional extra status a TA can set for themselves (e.g., Away)
  @Column({ type: 'enum', enum: ExtraTAStatus, nullable: true })
  extraTAStatus: ExtraTAStatus | null;
}
