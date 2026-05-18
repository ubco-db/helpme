import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm'
import { EmbeddableAssignmentQuestionModel } from './embeddable-assignment-question.entity'
import { EmbeddableFeedbackModel } from '../embeddable-feedback.entity'

@Entity('embeddable_assignment_feedback_model')
export class EmbeddableAssignmentFeedbackModel extends EmbeddableFeedbackModel {
  @Column({ type: 'integer' })
  assignmentId: number;

  @ManyToOne(() => EmbeddableAssignmentQuestionModel, (assignment) => assignment.submissions, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'questionId', referencedColumnName: 'questionId' },
    { name: 'assignmentId', referencedColumnName: 'assignmentId' },
  ])
  assignmentQuestion: EmbeddableAssignmentQuestionModel;
}