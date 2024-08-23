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
  @Column()
  serviceId: number;

  @Column()
  userId: number;

  @Column()
  isSubscribed: boolean;

  @ManyToOne(() => UserModel, (user) => user.subscriptions)
  user: UserModel;

  @ManyToOne(
    () => MailServiceModel,
    (mailService) => mailService.subscriptions,
    {
      onDelete: 'CASCADE',
    },
  )
  service: MailServiceModel;
}
