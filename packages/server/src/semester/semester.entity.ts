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

@Entity('semester_model')
export class SemesterModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  name: string;

  @Column('date')
  startDate: Date;

  @Column('date')
  endDate: Date;

  @Column('text', { nullable: true })
  description?: string;

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
}
