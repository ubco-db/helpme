import { ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { OrganizationModel } from '../organization/organization.entity';
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { CourseModel } from './course.entity';
import { Exclude } from 'class-transformer';

@Entity('super_course_model')
export class SuperCourseModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  name: string;

  @ManyToOne(
    () => OrganizationModel,
    (organization) => organization.superCourses,
  )
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationModel;

  @Column()
  organizationId: number;

  @Exclude()
  @OneToMany(() => CourseModel, (course) => course.superCourse)
  courses: CourseModel[];
}
