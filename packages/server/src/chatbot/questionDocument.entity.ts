import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatbotQuestionModel } from './question.entity';

@Entity('question_document_model')
export class QuestionDocumentModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  questionId: number;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column('text', { array: true })
  parts: string[];
}
