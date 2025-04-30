import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserModel } from '../profile/user.entity';

@Entity('desktop_notif_model')
export class DesktopNotifModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  endpoint: string;

  @Column({ nullable: true })
  expirationTime: Date;

  @Column('text')
  p256dh: string;

  @Column('text')
  auth: string;

  @ManyToOne((type) => UserModel, (user) => user.desktopNotifs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  @Column()
  userId: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'text', default: '' })
  name: string;
}
