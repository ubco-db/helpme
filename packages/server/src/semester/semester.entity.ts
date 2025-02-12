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
import { Exclude } from 'class-transformer';

@Entity('semester_model')
export class SemesterModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  name: string;

  // Integers from 1 to 12 to represent months
  @Column('integer')
  startMonth: number;

  @Column('integer')
  endMonth: number;

  @Column('integer')
  year: number;

  @Column('text', { nullable: true })
  description?: string;

  @JoinColumn({ name: 'courseId' })
  @OneToMany((type) => CourseModel, (course) => course.semester)
  courses: CourseModel[];

  @Column({ nullable: true })
  @Exclude()
  courseId: number;

  @JoinColumn({ name: 'organizationId' })
  @ManyToOne(
    (type) => OrganizationModel,
    (organization) => organization.semesters,
  )
  organization: OrganizationModel;

  @Column({ nullable: true })
  @Exclude()
  organizationId: number;
}
