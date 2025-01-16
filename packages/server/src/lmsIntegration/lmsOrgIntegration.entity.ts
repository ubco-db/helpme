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

@Entity('lms_org_integration_model')
export class LMSOrganizationIntegrationModel extends BaseEntity {
  @PrimaryColumn()
  organizationId: number;

  @PrimaryColumn({
    type: 'enum',
    enum: LMSIntegrationPlatform,
    enumName: 'lms_api_platform_enum',
  })
  apiPlatform: LMSIntegrationPlatform;

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
