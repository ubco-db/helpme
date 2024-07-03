import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('config_model')
export class ApplicationConfigModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint', default: 100 })
  max_async_questions: number;

  @Column({ type: 'bigint', default: 30 })
  max_queues_per_course: number;

  @Column({ type: 'bigint', default: 20 })
  max_question_types_per_queue: number;

  @Column({ type: 'bigint', default: 30 })
  max_questions_per_queue: number;

  @Column({ type: 'bigint', default: 40 })
  max_semesters: number;
}
