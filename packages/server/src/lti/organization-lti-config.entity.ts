import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationModel } from '../organization/organization.entity';

export type LTIAuthConfigType = {
  method: string;
  key: string;
};

@Entity('lti_config_model')
export class LTIConfigModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: false })
  url: string;

  @Column({ type: 'text', nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  clientId: string;

  @Column({ type: 'uuid', generated: 'uuid', nullable: false })
  clientSecret: string;

  @Column({ type: 'text', nullable: false })
  authenticationEndpoint: string;

  @Column({ type: 'text', nullable: false })
  accesstokenEndpoint: string;

  @Column({ type: 'jsonb', nullable: false })
  authConfig: LTIAuthConfigType;

  @Column({ type: 'integer', nullable: false })
  organizationId: number;

  @OneToOne(() => OrganizationModel, (org) => org.ltiConfig)
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationModel;
}
