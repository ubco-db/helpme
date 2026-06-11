import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserModel } from '../profile/user.entity';

@Entity('user_lti_identity_model')
export class UserLtiIdentityModel extends BaseEntity {
  @PrimaryColumn()
  userId: number;

  @PrimaryColumn({ type: 'text' })
  issuer: string;

  @Column({ type: 'text' })
  ltiUserId: string;

  @Column({ type: 'text', nullable: true })
  ltiEmail?: string;

  @ManyToOne(() => UserModel, (user) => user.ltiIdentities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserModel;
}
