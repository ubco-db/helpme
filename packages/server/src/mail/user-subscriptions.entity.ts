import {
  Entity,
  ManyToOne,
  BaseEntity,
  Column,
  PrimaryColumn,
  JoinColumn,
} from 'typeorm';
import { UserModel } from '../profile/user.entity';
import { MailServiceModel } from './mail-services.entity';

@Entity('user_subscriptions')
export class UserSubscriptionModel extends BaseEntity {
  @PrimaryColumn()
  serviceId: number;

  @PrimaryColumn()
  userId: number;

  @Column()
  isSubscribed: boolean;

  @ManyToOne(() => UserModel, (user) => user.subscriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  @ManyToOne(
    () => MailServiceModel,
    (mailService) => mailService.subscriptions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'serviceId' })
  service: MailServiceModel;
}
