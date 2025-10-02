import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { CourseModel } from '../course/course.entity';

@Entity('course_invite_model')
export class LtiCourseInviteModel extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  inviteCode: string;

  @PrimaryColumn({ type: 'integer' })
  courseId: number;

  @Column({ type: 'text' })
  email: string;

  @ManyToOne(() => CourseModel, (course) => course.ltiInvites, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'integer', nullable: true, default: 600 })
  expires?: number;
}
