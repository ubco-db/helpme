import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { QueueModel } from './queue.entity';

/**
 * This is essentially a set of configurations if professors would like to make a public queue page with an invite link
 */
@Entity('queue_invite_model')
export class QueueInviteModel extends BaseEntity {
  // Each queue can have 0 to 1 queue_invite
  @PrimaryColumn()
  queueId: number;

  @OneToOne((type) => QueueModel, (queue) => queue.queueInvite, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'queueId' })
  queue: QueueModel;

  @Column('boolean', { default: true })
  QRCodeEnabled: boolean;

  @Column('boolean', { default: false })
  isQuestionsVisible: boolean;

  // This controls whether this QR code will *also* invite the user to the course.
  // Usually, you would want this disabled once all of your students are registered otherwise anyone can join.
  @Column('boolean', { default: false })
  willInviteToCourse: boolean;

  @Column('text', { default: '' })
  inviteCode: string;

  @Column({
    type: 'varchar',
    length: 1, // length of 1 to restrict it to a single character
    default: 'L',
  })
  QRCodeErrorLevel: 'L' | 'M';
}
