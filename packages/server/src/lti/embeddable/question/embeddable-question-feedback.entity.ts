import { Entity, JoinColumn, ManyToOne } from 'typeorm'
import { EmbeddableQuestionModel } from './embeddable-question.entity'
import { EmbeddableFeedbackModel } from '../embeddable-feedback.entity'

@Entity('embeddable_question_feedback_model')
export class EmbeddableQuestionFeedbackModel extends EmbeddableFeedbackModel {
  @ManyToOne(() => EmbeddableQuestionModel, (question) => question.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  embeddableQuestion: EmbeddableQuestionModel;
}