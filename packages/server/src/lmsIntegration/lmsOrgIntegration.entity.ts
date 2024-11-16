import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { LMSIntegration } from '@koh/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { OrganizationModel } from '../organization/organization.entity';

@Entity('lms_org_integration_model')
export class LMSOrganizationIntegrationModel extends BaseEntity {
  @PrimaryColumn()
  organizationId: number;

  @PrimaryColumn({ type: 'enum', enum: LMSIntegration })
  apiPlatform: LMSIntegration;

  @Column({ type: 'text' })
  rootUrl: string;

  @OneToMany(
    (type) => LMSCourseIntegrationModel,
    (integration) => integration.orgIntegration,
  )
  courseIntegrations: LMSCourseIntegrationModel[];

  @ManyToOne((type) => OrganizationModel, (org) => org.organizationIntegrations)
  organization: OrganizationModel;
}
