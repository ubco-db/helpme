import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { UserModel } from '../profile/user.entity';

@Entity('lms_auth_state_model')
export class LMSAuthStateModel extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  state: string;

  @Column({ type: 'text', nullable: true })
  redirectUrl?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ type: 'integer', default: 60 })
  expiresAt: number;

  @Column({ type: 'integer' })
  userId: number;

  @ManyToOne(() => UserModel, (user) => user.pendingAuthStates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  @ManyToOne(
    () => LMSOrganizationIntegrationModel,
    (integration) => integration.pendingAuthStates,
    { onDelete: 'CASCADE' },
  )
  organizationIntegration: LMSOrganizationIntegrationModel;
}
