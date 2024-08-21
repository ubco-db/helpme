import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  BaseEntity,
  Column,
} from 'typeorm';
import { UserModel } from '../profile/user.entity';
import { MailServiceModel } from './mail-services.entity';

@Entity('user_subscriptions')
export class UserSubscriptionModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  serviceId: number;

  @Column()
  userId: number;

  @ManyToOne(() => UserModel, (user) => user.subscriptions)
  user: UserModel;

  @ManyToOne(() => MailServiceModel, (service) => service.subscriptions)
  service: MailServiceModel;
}
