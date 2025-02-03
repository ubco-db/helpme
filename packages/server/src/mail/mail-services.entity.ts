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

  @Column({
    type: 'enum',
    enum: MailServiceType,
    unique: true,
  })
  serviceType: MailServiceType;

  // this is the displayed name to users
  @Column()
  name: string;

  @Column()
  content: string; // TODO: figure out what this does

  @OneToMany(
    () => UserSubscriptionModel,
    (subscription) => subscription.service,
  )
  subscriptions: UserSubscriptionModel[];
}
