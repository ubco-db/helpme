import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationModel } from './organization.entity';
import { OrganizationUserModel } from './organization-user.entity';
import { OrganizationRole, OrgRoleChangeReason } from '@koh/common';
import { Exclude } from 'class-transformer';

@Entity('organization_role_history_model')
export class OrganizationRoleHistory extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;

  @Column({
    type: 'enum',
    enum: OrganizationRole,
    default: OrganizationRole.MEMBER,
    nullable: true,
  })
  fromRole?: OrganizationRole;

  @Column({
    type: 'enum',
    enum: OrganizationRole,
    default: OrganizationRole.MEMBER,
    nullable: true,
  })
  toRole?: OrganizationRole;

  @Exclude()
  @Column({ nullable: true })
  byOrgUserId: number;

  @ManyToOne((type) => OrganizationUserModel, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'byOrgUserId' })
  byUser: OrganizationUserModel;

  @Exclude()
  @Column({ nullable: true })
  toOrgUserId: number;

  @Column({
    type: 'enum',
    enum: OrgRoleChangeReason,
    default: OrgRoleChangeReason.unknown,
  })
  roleChangeReason: OrgRoleChangeReason;

  @ManyToOne((type) => OrganizationUserModel, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'toOrgUserId' })
  toOrgUser: OrganizationUserModel;

  @Column({ nullable: true })
  organizationId: number;

  @Exclude()
  @ManyToOne(
    (type) => OrganizationModel,
    (organization) => organization.organizationRoleHistory,
    { nullable: true, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationModel;
}
