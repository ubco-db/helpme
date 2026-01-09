import { CourseModel } from '../course/course.entity';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ChatbotDocPdfStatus {
  PENDING,
  UPLOADED,
}

@Entity('chatbot_doc_pdf_model')
export class ChatbotDocPdfModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true }) // is only null for a brief period during pdf conversion, should be guaranteed otherwise
  chatbotId: string;

  @Column({ type: 'text' })
  docName: string;

  @Column()
  courseId: number;

  @ManyToOne((type) => CourseModel, (course) => course.chatbot_doc_pdfs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @Column({ type: 'bytea', nullable: true }) // this is also nullable just briefly during upload
  docData: Buffer;

  @Column({ default: 0 })
  docSizeBytes: number;

  @Column({
    type: 'enum',
    enum: ChatbotDocPdfStatus,
    default: ChatbotDocPdfStatus.UPLOADED,
  })
  status: ChatbotDocPdfStatus;
}
