import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  OneToMany,
} from 'typeorm';
import { OrganizationRole } from '@koh/common';
import { UserSubscriptionModel } from './user-subscriptions.entity';

@Entity('mail_services')
export class MailServiceModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  mailType: OrganizationRole;

  @Column()
  name: string;

  @Column()
  content: string;

  @OneToMany(
    () => UserSubscriptionModel,
    (subscription) => subscription.service,
  )
  subscriptions: UserSubscriptionModel[];
}
