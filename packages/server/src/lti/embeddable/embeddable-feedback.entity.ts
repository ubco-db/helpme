import { BaseEntity, Column, CreateDateColumn, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { UserModel } from '../../profile/user.entity'

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

  @Column({ type: 'text', nullable: true })
  humanFeedback?: string;

  @Column({ type: 'integer' })
  questionId: number;

  @Column({ type: 'integer' })
  userId: number;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserModel;
}