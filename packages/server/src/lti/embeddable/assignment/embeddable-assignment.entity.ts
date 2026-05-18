import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { EmbeddableAssignmentQuestionModel } from './embeddable-assignment-question.entity'
import { CourseModel } from '../../../course/course.entity'
import { Exclude } from 'class-transformer'

@Entity('embeddable_assignment_model')
export class EmbeddableAssignmentModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  name: string;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  availableFrom?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  availableUntil?: Date;

  @OneToMany(() => EmbeddableAssignmentQuestionModel, (question) => question.assignment)
  questions: EmbeddableAssignmentQuestionModel[];

  @Column()
  courseId: number;

  @ManyToOne(() => CourseModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;
}