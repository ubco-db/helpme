import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { Exclude } from 'class-transformer';

@Entity('iframe_question_model')
export class IframeQuestionModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  createdAt: Date;

  @ManyToOne(() => CourseModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;

  @Column()
  courseId: number;

  @Column({ type: 'text' })
  questionText: string;

  // criteria that the AI uses to evaluate the student's response
  // if empty, the course-level default criteria can apply
  @Column({ type: 'text', nullable: true })
  criteriaText: string;
}
