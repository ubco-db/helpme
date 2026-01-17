import { Exclude } from 'class-transformer';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationModel } from './organization.entity';
import { CourseModel } from '../course/course.entity';

// TODO: remove entity and move attributes to course model, its a one to many relationship, not many to many, so there should be no join table
@Entity('organization_course_model')
export class OrganizationCourseModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    (type) => OrganizationModel,
    (organization) => organization.organizationCourses,
  )
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationModel;

  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  createdAt: Date;

  @Column({ nullable: true })
  organizationId: number;

  @OneToOne((type) => CourseModel, (course) => course.organizationCourse, {
    cascade: true,
  })
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;

  @Column({ nullable: true })
  courseId: number;
}
