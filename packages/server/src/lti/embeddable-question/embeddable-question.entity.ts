import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { CourseModel } from '../../course/course.entity'
import { Exclude } from 'class-transformer'

@Entity('embeddable_question_model')
export class EmbeddableQuestionModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  availableFrom?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  availableUntil?: Date;

  @ManyToOne(() => CourseModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;

  @Column()
  courseId: number;

  // optional: professors can name their questions
  @Column({ type: 'text', nullable: true })
  name: string;

  @Column({ type: 'text' })
  questionText: string;

  // criteria included in the prompt for feedback generation
  @Column({ type: 'text' })
  criteriaText: string;

  // instructions included in the prompt for feedback generation
  @Column({ type: 'text', nullable: true })
  instructions?: string;
}
