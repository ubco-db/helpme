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

  // criteria included in the prompt for feedback generation
  @Column({ type: 'text' })
  criteriaText: string;
}
