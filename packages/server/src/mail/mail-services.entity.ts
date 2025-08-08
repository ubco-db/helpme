import {
  BaseEntity,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MailServiceType, OrganizationRole } from '@koh/common';
import { UserSubscriptionModel } from './user-subscriptions.entity';

@Entity('mail_services')
export class MailServiceModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: OrganizationRole,
    default: OrganizationRole.MEMBER,
  })
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

  @OneToMany(
    () => UserSubscriptionModel,
    (subscription) => subscription.service,
  )
  subscriptions: UserSubscriptionModel[];
}
