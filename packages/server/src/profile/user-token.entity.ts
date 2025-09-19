import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserModel } from './user.entity';

export enum TokenType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export enum TokenAction {
  ACTION_COMPLETE = 'ACTION_COMPLETE',
  ACTION_PENDING = 'ACTION_PENDING',
}

@Entity('user_token_model')
export class UserTokenModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  token: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ type: 'int', default: 60 * 60 * 24 })
  expiresIn: number;

  @Column({
    type: 'text',
    enum: TokenType,
    default: TokenType.EMAIL_VERIFICATION,
  })
  token_type: TokenType;

  @Column({
    type: 'text',
    enum: TokenAction,
    default: TokenAction.ACTION_PENDING,
  })
  token_action: TokenAction;

  @ManyToOne((type) => UserModel, (user) => user.tokens, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: UserModel;
}
