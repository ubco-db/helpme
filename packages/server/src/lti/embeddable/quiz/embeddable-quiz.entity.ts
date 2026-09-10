import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CourseModel } from '../../../course/course.entity';
import { Exclude } from 'class-transformer';

@Entity('embeddable_quiz_model')
@Unique(['id', 'courseId'])
export class EmbeddableQuizModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  createdAt: Date;

  @ManyToOne(() => CourseModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;

  @Column({ type: 'integer', nullable: false })
  courseId: number;

  @Column({ type: 'text', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: false, default: '' })
  objective: string;

  @Column({ type: 'text', nullable: false, default: '' })
  background: string;
}
