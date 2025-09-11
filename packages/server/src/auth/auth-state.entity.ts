import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { OrganizationModel } from '../organization/organization.entity';

@Entity('auth_state_model')
export class AuthStateModel extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  state: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ type: 'integer', default: 60 })
  expiresIn: number;

  @Column({ type: 'integer', nullable: false })
  organizationId: number;

  @ManyToOne(() => OrganizationModel, (org) => org.userAuthStates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationModel;
}
