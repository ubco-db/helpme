import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { EmbeddableQuestionModel } from './embeddable-question.entity'
import { UserModel } from '../../profile/user.entity'

@Entity('embeddable_feedback_model')
export class EmbeddableFeedbackModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'text', nullable: false })
  submission: string;

  @Column({ type: 'text', nullable: false })
  aiFeedback: string;

  @Column({ type: 'double precision', nullable: true })
  aiGrade?: number;

  @Column({ type: 'double precision', nullable: true })
  humanGrade?: number;

  @Column({ type: 'integer' })
  questionId: number;

  @ManyToOne(() => EmbeddableQuestionModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  embeddableQuestion: EmbeddableQuestionModel;

  @Column({ type: 'integer' })
  userId: number;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserModel;
}