import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

@Entity('lti_identity_token_model')
export class LtiIdentityTokenModel extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  code: string;

  @Column({ type: 'text' })
  issuer: string;

  @Column({ type: 'text' })
  ltiUserId: string;

  @Column({ type: 'text', nullable: true })
  ltiEmail?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ type: 'integer', nullable: true, default: 600 })
  expiresInSeconds?: number;
}
