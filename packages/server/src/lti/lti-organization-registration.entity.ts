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

/**
 * Assigns an LTI registration to an organization's LMS integration for launches.
 * An organization can have multiple registrations, each assigned by a system admin.
 * The LTI client ID is separate from the LMS API clientId.
 * Resolve the organization before looking up a course because Canvas course IDs
 * are not globally unique.
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
