import {
  BaseEntity,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserModel } from '../profile/user.entity';
import { CalendarModel } from './calendar.entity';

/**
 * Represents the many to many relationship between a staff member and a calendar event.
 * Each staff member can have 0 to many calendar events they are assigned to,
 * and each calendar event can have 0 to many staff members assigned to it.
 */
@Entity('calendar_staff_model')
export class CalendarStaffModel extends BaseEntity {
  @ManyToOne((type) => UserModel, (user) => user.calendarEvents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  @PrimaryColumn()
  userId: number;

  @ManyToOne((type) => CalendarModel, (calendar) => calendar.staff, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'calendarId' })
  calendar: CalendarModel;

  @PrimaryColumn()
  calendarId: number;
}
