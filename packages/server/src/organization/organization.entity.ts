import { Exclude } from 'class-transformer';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationUserModel } from './organization-user.entity';
import { OrganizationCourseModel } from './organization-course.entity';
import { LMSOrganizationIntegrationModel } from '../lmsIntegration/lmsOrgIntegration.entity';
import { SemesterModel } from '../semester/semester.entity';
import { SuperCourseModel } from 'course/super-course.entity';
import { OrganizationSettingsModel } from './organization_settings.entity';
import { OrganizationRoleHistory } from './organization_role_history.entity';
import { OrganizationChatbotSettingsModel } from '../chatbot/chatbot-infrastructure-models/organization-chatbot-settings.entity';
import { AuthStateModel } from '../auth/auth-state.entity';
import { ProfInviteModel } from 'course/prof-invite/prof-invite.entity';

@Entity('organization_model')
export class OrganizationModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  name: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  createdAt: Date;

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

  @Column('text', { array: true, nullable: true })
  ssoEmailPatterns: string[];

  @Exclude()
  @OneToOne(
    () => OrganizationSettingsModel,
    (organizationSettings) => organizationSettings.organization,
  )
  organizationSettings: OrganizationSettingsModel;

  @Exclude()
  @OneToMany(
    () => OrganizationRoleHistory,
    (roleHistory) => roleHistory.organization,
  )
  organizationRoleHistory: OrganizationRoleHistory[];

  @Exclude()
  @JoinColumn({ name: 'organizationId' })
  @OneToMany(() => SemesterModel, (semester) => semester.organization)
  semesters: SemesterModel[];

  @Exclude()
  @JoinColumn({ name: 'organizationId' })
  @OneToMany(
    () => OrganizationUserModel,
    (organizationUser) => organizationUser.organization,
  )
  organizationUsers: OrganizationUserModel[];

  @Exclude()
  @JoinColumn({ name: 'organizationId' })
  @OneToMany(
    () => OrganizationCourseModel,
    (organizationCourse) => organizationCourse.organization,
  )
  organizationCourses: OrganizationCourseModel[];

  @Exclude()
  @JoinColumn({ name: 'organizationId' })
  @OneToMany(
    () => LMSOrganizationIntegrationModel,
    (integration) => integration.organization,
  )
  organizationIntegrations: LMSOrganizationIntegrationModel[];

  @Exclude()
  @JoinColumn({ name: 'organizationId' })
  @OneToMany(() => SuperCourseModel, (superCourse) => superCourse.organization)
  superCourses: SuperCourseModel[];

  @Exclude()
  @OneToOne(
    () => OrganizationChatbotSettingsModel,
    (orgChatbotSettings) => orgChatbotSettings.organization,
  )
  chatbotSettings: OrganizationChatbotSettingsModel;

  @Exclude()
  @OneToMany(
    () => OrganizationChatbotSettingsModel,
    (orgChatbotSettings) => orgChatbotSettings.organization,
  )
  userAuthStates: AuthStateModel;

  @Exclude()
  @JoinColumn({ name: 'organizationId' })
  @OneToMany((type) => ProfInviteModel, (profInvite) => profInvite.organization)
  profInvites: ProfInviteModel[];
}
