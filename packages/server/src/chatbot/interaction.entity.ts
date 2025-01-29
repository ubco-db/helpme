import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { UserModel } from '../profile/user.entity';
import { ChatbotQuestionModel } from './question.entity';

@Entity('chatbot_interactions_model')
export class InteractionModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  timestamp: Date;

  @ManyToOne(() => CourseModel, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'course' })
  course: CourseModel;

  @ManyToOne(() => UserModel, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user' })
  user: UserModel;

  @OneToMany(
    (type) => ChatbotQuestionModel,
    (question) => question.interaction,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'interaction' })
  questions: ChatbotQuestionModel[];
}
