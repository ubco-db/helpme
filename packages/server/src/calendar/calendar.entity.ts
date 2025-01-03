import { CourseModel } from '../course/course.entity';
import { Exclude } from 'class-transformer';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { calendarEventLocationType } from '@koh/common';
import { CalendarStaffModel } from './calendar-staff.entity';

/**
 * Note that by "calendar", it's not really a calendar and should be called an "event" imo, though we already have a different thing called "event"
 */
@Entity('calendar_model')
export class CalendarModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  title: string;

  @Column({ type: 'timestamp' })
  start: Date;

  @Column({ type: 'timestamp' })
  end: Date;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column('text', { array: true, nullable: true, default: null })
  daysOfWeek: string[];

  @Column({ nullable: true })
  allDay: boolean;

  @Column({ type: 'enum', enum: calendarEventLocationType })
  locationType: calendarEventLocationType;

  @Column({ nullable: true })
  locationOnline: string;

  @Column({ nullable: true })
  locationInPerson: string;

  @ManyToOne((type) => CourseModel)
  @JoinColumn({ name: 'course' })
  @Exclude()
  course: CourseModel;

  @Column({ length: 7, nullable: true, default: '#3788d8' })
  color: string;

  @OneToMany((type) => CalendarStaffModel, (csm) => csm.calendar)
  staff: CalendarStaffModel[];
}
