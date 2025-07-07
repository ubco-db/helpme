import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { OrganizationModel } from './organization.entity';

@Entity('organization_settings_model')
export class OrganizationSettingsModel extends BaseEntity {
  // OrganizationSettings existence is dependent on the existence of a course
  @PrimaryColumn()
  organizationId: number;

  @OneToOne(
    (type) => OrganizationModel,
    (organization) => organization.organizationSettings,
    { onUpdate: 'CASCADE', onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationModel;

  @Column('boolean', { default: true })
  allowProfCourseCreate: boolean;
}
