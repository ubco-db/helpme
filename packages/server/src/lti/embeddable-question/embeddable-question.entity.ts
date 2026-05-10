import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from '../../course/course.entity';
import { Exclude } from 'class-transformer';

@Entity('embeddable_question_model')
export class EmbeddableQuestionModel extends BaseEntity {
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

  // instructions included in the prompt for feedback generation
  @Column({ type: 'text', nullable: true })
  instructions?: string;
}
