import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { ChatbotChunkMetadata } from '@koh/common';

/* This is just the citations (i.e. when a question is asked, the relevant source document chunks are gathered and stored here) */
@Entity('chatbot_question_source_document_citation_model')
export class ChatbotQuestionSourceDocumentCitationModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  citationId: number;

  @Column()
  sourceDocumentChunkId: string;

  @Column()
  pageContent: string;

  @Column({ nullable: true })
  content: string;

  @Column()
  docName: string;

  @Column({ type: 'jsonb' })
  metadata: ChatbotChunkMetadata;

  @Column({ nullable: true })
  sourceLink: string;

  @Column('integer', { array: true, nullable: true })
  pageNumbers: number[];

  @Column({ nullable: true })
  pageNumber: number;
  // not relating it to chatbot questions themselves just yet TODO: do this
  // (partially because we get the source documents from the chatbot repo api and not from helpme db)
  // @ManyToOne(() => ChatbotQuestionModel)
  // @JoinColumn({ name: 'questionId' })
  // question: ChatbotQuestionModel;

  @Column()
  asyncQuestionId: number;

  // only really using for async questions atm
  @ManyToOne(
    () => AsyncQuestionModel,
    (asyncQuestion) => asyncQuestion.citations,
  )
  @JoinColumn({ name: 'asyncQuestionId' })
  asyncQuestion: AsyncQuestionModel;
}
