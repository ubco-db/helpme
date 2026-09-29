import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { LMSIntegrationPlatform } from '@koh/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { OrganizationModel } from '../organization/organization.entity';
import { LMSAuthStateModel } from './lms-auth-state.entity';
import { LMSAccessTokenModel } from './lms-access-token.entity';
import { Exclude } from 'class-transformer';

@Entity('lms_org_integration_model')
export class LMSOrganizationIntegrationModel extends BaseEntity {
  @PrimaryColumn()
  organizationId: number;

  @PrimaryColumn({
    type: 'text',
  })
  apiPlatform: LMSIntegrationPlatform;

  @Column({ type: 'text' })
  rootUrl: string;

  @Column({ type: 'boolean', default: true })
  secure: true;

  @Column({ type: 'text', nullable: true })
  clientId?: string;

  /** This attribute connects the System-level LTI Platform integration with the Org-level LMS integration.
   * (PlatformModel.kid === lmsOrgModel.ltiPlatformId)
   * LTI requests from Canvas only give what System-level LTI Platform its from (the issuer + PlatformModel.clientId, NOT to be confused with the Org-level LMS integration clientId which is separate), but we need the Org-level LTI Platform too.
   * This lets us go: Oh new LTI request (called a launch) from this specific `kid` (which gets mapped to the Platform 'Canvas') just arrived asking for some Embedded questions for this specific canvasCourseId.
   * But we need to make sure this HelpMe Org + Course have integrations with this 'Canvas' Platform registered
   * (since two separate Canvas Platform instances (like from different universities) could get courses with the same specific canvasCourseId,
   * which is why we can't just join canvasCourseId with CourseIntegration with OrgIntegration).
   * This attribute just lets us join the LTI Platform with the OrgIntegration to verify it.
   *
   * Only system admins may assign this through the Admin Panel -> LTI Integrations.
   * We make it `unique` so that multiple HelpMe Orgs can't integrate with the same Canvas instance.
   */
  @Column({ type: 'text', nullable: true, unique: true })
  ltiPlatformId: string | null;

  @Exclude()
  @Column({ type: 'text', nullable: true })
  clientSecret?: string;

  @OneToMany(
    () => LMSCourseIntegrationModel,
    (integration) => integration.orgIntegration,
    { onDelete: 'CASCADE' },
  )
  courseIntegrations: LMSCourseIntegrationModel[];

  @ManyToOne(() => OrganizationModel, (org) => org.organizationIntegrations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId', referencedColumnName: 'id' })
  organization: OrganizationModel;

  @Exclude()
  @OneToMany(
    () => LMSAuthStateModel,
    (authState) => authState.organizationIntegration,
    { onDelete: 'CASCADE' },
  )
  pendingAuthStates: LMSAuthStateModel[];

  @Exclude()
  @OneToMany(
    () => LMSAccessTokenModel,
    (accessToken) => accessToken.organizationIntegration,
    { onDelete: 'CASCADE' },
  )
  userAccessTokens: LMSAccessTokenModel[];
}
