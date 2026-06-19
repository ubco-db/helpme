import {
  AlertDeliveryMode,
  AlertPayload,
  AlertType,
  RephraseQuestionPayload,
  PromptStudentToLeaveQueuePayload,
  DocumentProcessedPayload,
  AsyncQuestionUpdatePayload,
} from '@koh/common';
import { Exclude } from 'class-transformer';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { UserModel } from '../profile/user.entity';

@Entity('alert_model')
export class AlertModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: AlertType })
  alertType: AlertType;

  @Column({
    type: 'enum',
    enum: AlertDeliveryMode,
    default: AlertDeliveryMode.MODAL,
  })
  deliveryMode: AlertDeliveryMode;

  @CreateDateColumn({ type: 'timestamptz' })
  sentAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date; // for MODAL alerts, it's when the user closes the modal. For FEED alerts, it's when the user reads/dismisses the alert.

  @ManyToOne((type) => UserModel, (user) => user.alerts)
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  @Column({ nullable: true })
  @Exclude()
  userId: number;

  @ManyToOne((type) => CourseModel, (course) => course.alerts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @Column({ nullable: true })
  @Exclude()
  courseId: number;

  @Column({ type: 'json' })
  payload:
    | AlertPayload
    | RephraseQuestionPayload
    | PromptStudentToLeaveQueuePayload
    | DocumentProcessedPayload
    | AsyncQuestionUpdatePayload;
}
