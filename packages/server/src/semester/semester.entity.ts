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
import { OrganizationModel } from '../organization/organization.entity';
import { antdTagColor } from '@koh/common';

@Entity('semester_model')
export class SemesterModel extends BaseEntity {
  // Need to set defaults for migrations and auto-sync to work properly but those semesters will be deleted manually so:
  // TODO: remove defaults once all production semesters are set to null and generate a new migration the reflect the changes
  /**
   * Run the below query (also found in PR description) after updating this table in production to set semesters to null for production semesters
   * UPDATE "course_model"
   * SET "semesterId" = NULL
   * WHERE "semesterId" IS NOT NULL;
   *
   * DELETE FROM "semester_model";
   */

  @PrimaryGeneratedColumn()
  id: number;

  @Column('text', { default: 'Legacy Semester' })
  name: string;

  @Column('date', { default: () => 'CURRENT_DATE' })
  startDate: Date;

  @Column('date', { default: () => 'CURRENT_DATE' })
  endDate: Date;

  @Column('text', { default: '', nullable: true })
  description: string;

  @JoinColumn({ name: 'semesterId' })
  @OneToMany((type) => CourseModel, (course) => course.semester)
  courses: CourseModel[];

  @JoinColumn({ name: 'organizationId' })
  @ManyToOne(
    (type) => OrganizationModel,
    (organization) => organization.semesters,
    { onDelete: 'CASCADE' },
  )
  organization: OrganizationModel;

  @Column({ nullable: true })
  organizationId: number;

  @Column({
    type: 'enum',
    enum: antdTagColor,
    default: antdTagColor.blue,
  })
  color: antdTagColor;
}
