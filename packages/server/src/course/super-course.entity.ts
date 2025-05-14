import { ManyToOne, JoinColumn, OneToMany, BaseEntity } from 'typeorm';
import { OrganizationModel } from '../organization/organization.entity';
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { CourseModel } from './course.entity';
import { Exclude } from 'class-transformer';

/* A super course is basically just an association between multiple courses.
  One of these is created when a course is cloned and they have associatedWithOriginalCourse to true.
  This creates a super course with the original course and the cloned course.
  If the original course already has a super course, the cloned course is added to that super course.
*/
@Entity('super_course_model')
export class SuperCourseModel extends BaseEntity {
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
