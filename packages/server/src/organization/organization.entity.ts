import { Exclude } from 'class-transformer';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationCourseModel } from './organization-course.entity';
import { LMSOrganizationIntegrationModel } from '../lmsIntegration/lmsOrgIntegration.entity';
import { UserModel } from '../profile/user.entity';

@Entity('organization_model')
export class OrganizationModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { nullable: true })
  logoUrl: string;

  @Column('text', { nullable: true })
  bannerUrl: string;

  @Column('text', { nullable: true })
  websiteUrl: string;

  @Column('boolean', { default: false })
  ssoEnabled: boolean;

  @Column('boolean', { default: false })
  legacyAuthEnabled: boolean;

  @Column('boolean', { default: true })
  googleAuthEnabled: boolean;

  @Column('text', { nullable: true })
  ssoUrl: string;

  @Exclude()
  @JoinColumn({ name: 'organizationId' })
  @OneToMany((type) => UserModel, (user) => user.organization)
  @JoinColumn({ name: 'organizationId' })
  users: UserModel[];

  @Exclude()
  @JoinColumn({ name: 'organizationId' })
  @OneToMany(
    (type) => OrganizationCourseModel,
    (organizationCourse) => organizationCourse.organization,
  )
  organizationCourses: OrganizationCourseModel[];

  @Exclude()
  @JoinColumn({ name: 'organizationId' })
  @OneToMany(
    (type) => LMSOrganizationIntegrationModel,
    (integration) => integration.organization,
  )
  organizationIntegrations: LMSOrganizationIntegrationModel[];
}
