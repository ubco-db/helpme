import {
  ManyToOne,
  JoinColumn,
  ManyToMany,
  BaseEntity,
  JoinTable,
  EntityManager,
} from 'typeorm';
import { OrganizationModel } from '../organization/organization.entity';
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { CourseModel } from './course.entity';
import { Exclude } from 'class-transformer';
import { SuperCoursePurpose } from '@koh/common';

/* A super course is basically just an association between multiple courses.
  It can be used to connect course clones or to group hidden chatbot agent
  courses behind one visible parent course.
*/
@Entity('super_course_model')
export class SuperCourseModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  name: string;

  @Column({
    type: 'enum',
    enum: SuperCoursePurpose,
    nullable: true,
  })
  purpose?: SuperCoursePurpose;

  @ManyToOne(
    () => OrganizationModel,
    (organization) => organization.superCourses,
  )
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationModel;

  @Column()
  organizationId: number;

  @Exclude()
  @ManyToMany(() => CourseModel, (course) => course.superCourses)
  @JoinTable({
    name: 'super_course_course_model',
    joinColumn: { name: 'superCourseId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'courseId', referencedColumnName: 'id' },
  })
  courses: CourseModel[];

  /** Finds the super course group of a given purpose that contains the given course. */
  static findGroupForCourse(
    courseId: number,
    purpose: SuperCoursePurpose,
    manager?: EntityManager,
  ): Promise<SuperCourseModel | null> {
    const queryBuilder = manager
      ? manager
          .getRepository(SuperCourseModel)
          .createQueryBuilder('superCourse')
      : SuperCourseModel.createQueryBuilder('superCourse');

    return queryBuilder
      .innerJoin('superCourse.courses', 'matchedCourse')
      .leftJoinAndSelect('superCourse.courses', 'courses')
      .where('superCourse.purpose = :purpose', { purpose })
      .andWhere('matchedCourse.id = :courseId', { courseId })
      .getOne();
  }
}
