import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserModel } from '../profile/user.entity';

@Entity('chat_token_model')
export class ChatTokenModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', unique: true })
  token: string;

  @Column({ default: 0 })
  used: number;

  @Column({ default: 30 })
  max_uses: number;

  @OneToOne((type) => UserModel, (user) => user.chat_token, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user' })
  user: UserModel;
}
