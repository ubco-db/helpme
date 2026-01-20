import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InteractionModel } from './interaction.entity';

// each chatbot_question links to one interaction
@Entity('chatbot_questions_model')
export class ChatbotQuestionModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  vectorStoreId: string;

  @Column({ type: 'integer', default: 0 })
  userScore: number;

  @Column({ type: 'boolean', default: false })
  isPreviousQuestion: boolean;

  @Column({ type: 'integer' })
  interactionId: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  timestamp: Date;

  @ManyToOne(() => InteractionModel)
  @JoinColumn({ name: 'interactionId' })
  interaction: InteractionModel;
}
