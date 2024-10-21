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
import { CourseModel } from '../course/course.entity';
import { QueueModel } from '../queue/queue.entity';
import { UserModel } from 'profile/user.entity';

@Entity('queue_chat_model')
export class QueueChatModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CourseModel, (course) => course.queueChats, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;

  @Column({ nullable: true })
  courseId: number;

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

  @Column({ nullable: true })
  staffId: number;

  @ManyToOne(() => UserModel, (student) => student.studentChats, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'studentId' })
  @Exclude()
  student: UserModel;

  @Column({ nullable: true })
  studentId: number;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date;

  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  closedAt: Date;

  @Column({ type: 'int', nullable: true })
  messageCount: number;
}
