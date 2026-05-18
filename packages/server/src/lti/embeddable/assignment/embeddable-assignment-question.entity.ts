import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm'
import { EmbeddableAssignmentModel } from './embeddable-assignment.entity'
import { EmbeddableQuestionModel } from '../question/embeddable-question.entity'
import { EmbeddableAssignmentFeedbackModel } from './embeddable-assignment-feedback.entity'

@Entity('embeddable_assignment_question_model')
export class EmbeddableAssignmentQuestionModel extends BaseEntity {
  @PrimaryColumn({ type: 'integer' })
  assignmentId: number;

  @PrimaryColumn({ type: 'integer' })
  questionId: number;

  @Column({ type: 'integer' })
  order: number;

  @ManyToOne(() => EmbeddableAssignmentModel, (assignment) => assignment.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignmentId' })
  assignment: EmbeddableAssignmentModel;

  @ManyToOne(() => EmbeddableQuestionModel, (question) => question.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: EmbeddableQuestionModel;

  @OneToMany(() => EmbeddableAssignmentFeedbackModel, (feedback) => feedback.assignmentQuestion)
  submissions: EmbeddableAssignmentFeedbackModel;
}