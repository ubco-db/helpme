import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
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

  @PrimaryColumn({
    type: 'enum',
    enum: LMSIntegration,
    enumName: 'lms_api_platform_enum',
  })
  apiPlatform: LMSIntegration;

  @Column({ type: 'text' })
  rootUrl: string;

  @OneToMany(
    (type) => LMSCourseIntegrationModel,
    (integration) => integration.orgIntegration,
    { onDelete: 'CASCADE' },
  )
  courseIntegrations: LMSCourseIntegrationModel[];

  @ManyToOne(
    (type) => OrganizationModel,
    (org) => org.organizationIntegrations,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'organizationId', referencedColumnName: 'id' })
  organization: OrganizationModel;
}
