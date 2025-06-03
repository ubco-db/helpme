import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { CourseModel } from './course.entity';

@Entity('course_settings_model')
export class CourseSettingsModel extends BaseEntity {
  // CourseSettings existence is dependent on the existence of a course
  @PrimaryColumn()
  courseId: number;

  @OneToOne((type) => CourseModel, (course) => course.courseSettings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @Column('boolean', { default: true })
  chatBotEnabled: boolean;

  @Column('boolean', { default: true })
  asyncQueueEnabled: boolean;

  @Column('boolean', { default: true })
  adsEnabled: boolean; // Not in use

  @Column('boolean', { default: true })
  queueEnabled: boolean;

  @Column('boolean', { default: false })
  scheduleOnFrontPage: boolean;

  @Column('boolean', { default: true })
  asyncCentreAIAnswers: boolean;

  @Column('boolean', { default: true })
  asyncCentreDefaultAnonymous: boolean;

  @Column('boolean', { default: true })
  asyncCentreAllowPublic: boolean;
}
