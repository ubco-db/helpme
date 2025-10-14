import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { UserModel } from '../profile/user.entity';
import { ChatbotQuestionModel } from './chatbot-question.entity';

// A chatbot interaction is basically a conversation between a user and the chatbot.
@Entity('chatbot_interactions_model')
export class InteractionModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  timestamp: Date;

  @Column({ type: 'integer' })
  courseId: number;

  @ManyToOne(() => CourseModel)
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @Column({ type: 'integer' })
  userId: number;

  @ManyToOne(() => UserModel)
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  @OneToMany((type) => ChatbotQuestionModel, (question) => question.interaction)
  @JoinColumn({ name: 'interaction' })
  questions: ChatbotQuestionModel[];
}
