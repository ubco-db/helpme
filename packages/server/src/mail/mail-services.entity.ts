import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  OneToMany,
} from 'typeorm';
import { OrganizationRole, MailServiceType } from '@koh/common';
import { UserSubscriptionModel } from './user-subscriptions.entity';

@Entity('mail_services')
export class MailServiceModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  mailType: OrganizationRole;

  // this is the displayed name to users
  @Column({
    type: 'enum',
    enum: MailServiceType,
    unique: true,
  })
  serviceType: MailServiceType;

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
