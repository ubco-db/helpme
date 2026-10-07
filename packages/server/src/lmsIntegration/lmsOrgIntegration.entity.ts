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
