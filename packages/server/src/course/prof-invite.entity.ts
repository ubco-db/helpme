import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from './course.entity';
import { UserModel } from 'profile/user.entity';
import { Exclude } from 'class-transformer';

/**
 * These are temporary invite links that will automatically promote the user to professor when accepted
 */
@Entity('prof_invite_model')
export class ProfInviteModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  courseId: number;

  @ManyToOne((type) => CourseModel, (course) => course.profInvites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;

  @Column({ default: 1 })
  maxUses: number;

  // I thought about keeping track with a relationship with the users table but meh I don't think it'll add much benefit
  @Column({ default: 0 })
  usesUsed: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  expiresAt: Date;

  @Column('boolean', { default: true })
  makeOrgProf: boolean;

  @Column()
  adminUserId: number;

  // To keep track of what admin created the invite (useful for sending them an email when the invite is used)
  @ManyToOne((type) => UserModel, (user) => user.createdProfInvites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'adminUserId' })
  adminUser: UserModel;
}
