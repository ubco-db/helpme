import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { LMSIntegrationPlatform } from '@koh/common';
import { LMSOrganizationIntegrationModel } from '../lmsIntegration/lmsOrgIntegration.entity';

/** This entity connects the System-level LTI Platform integration with the Org-level LMS integration.
 * (PlatformModel.kid === lmsOrgModel.ltiPlatformId)
 * LTI requests from Canvas only give what System-level LTI Platform its from (the issuer + PlatformModel.clientId, NOT to be confused with the Org-level LMS integration clientId which is separate), but we need the Org-level LTI Platform too.
 * This lets us go: Oh new LTI request (called a launch) from this specific `kid` (which gets mapped to the Platform 'Canvas') just arrived asking for some Embedded questions for this specific canvasCourseId.
 * But we need to make sure this HelpMe Org + Course have integrations with this 'Canvas' Platform registered
 * (since two separate Canvas Platform instances (like from different universities) could get courses with the same specific canvasCourseId,
 * which is why we can't just join canvasCourseId with CourseIntegration with OrgIntegration).
 * This entity just lets us join the LTI Platform with the OrgIntegration to verify it.
 *
 * Only system admins may assign this through the Admin Panel -> LTI Integrations.
 * We make it `unique` so that multiple HelpMe Orgs can't integrate with the same Canvas instance.
 */
@Entity()
export class LtiOrganizationRegistrationModel extends BaseEntity {
  // PlatformModel.kid lives in the separate LTI database, so this is not a database FK.
  @PrimaryColumn({ type: 'text' })
  ltiPlatformId: string;

  @Column({ type: 'integer' })
  organizationId: number;

  @Column({ type: 'text' })
  apiPlatform: LMSIntegrationPlatform;

  @ManyToOne(() => LMSOrganizationIntegrationModel, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn([
    {
      name: 'organizationId',
      referencedColumnName: 'organizationId',
    },
    {
      name: 'apiPlatform',
      referencedColumnName: 'apiPlatform',
    },
  ])
  orgIntegration: LMSOrganizationIntegrationModel;
}
