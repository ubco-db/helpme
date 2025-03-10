import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { QueueModel } from '../queue/queue.entity';
import { UserModel } from '../profile/user.entity';

@Entity('queue_chats_model')
export class QueueChatsModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => QueueModel, (q) => q.chats, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'queueId' })
  @Exclude()
  queue: QueueModel;

  @Column({ nullable: true })
  queueId: number | null;

  @ManyToOne(() => UserModel, (staff) => staff.staffChats, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'staffId' })
  @Exclude()
  staff: UserModel;

  @Column()
  staffId: number;

  @ManyToOne(() => UserModel, (student) => student.studentChats, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  @Exclude()
  student: UserModel;

  // User Id of entry in user table (not student number)
  @Column()
  studentId: number;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date;

  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  closedAt: Date;

  @Column({ type: 'int', nullable: true })
  messageCount: number;
}
