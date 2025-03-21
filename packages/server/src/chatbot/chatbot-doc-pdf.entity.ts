import { CourseModel } from '../course/course.entity';
import {
  Entity,
  BaseEntity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('chatbot_doc_pdf_model')
export class ChatbotDocPdfModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  idHelpMeDB: number;

  @Column({ type: 'text' })
  docIdChatbotDB: string;

  @Column({ type: 'text' })
  docName: string;

  @Column({ type: 'text' })
  docUrl: string;

  @Column()
  courseId: number;

  @ManyToOne((type) => CourseModel, (course) => course.chatbot_doc_pdfs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @Column({ type: 'bytea' })
  docData: Buffer;
}
