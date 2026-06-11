import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserModel } from '../profile/user.entity';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { DataEndec } from '../dataEndec';
import { ERROR_MESSAGES, LMSPostResponseBody } from '@koh/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { BadRequestException } from '@nestjs/common';

export class LMSAccessToken {
  access_token: string;
  token_type: string;
  userId: number;
  refresh_token: string;
  expires_in: number; // Seconds

  constructor() {
    this.access_token = '';
    this.token_type = '';
    this.refresh_token = '';
    this.userId = 1;
    this.expires_in = 0;
  }
}

@Entity('lms_access_token_model')
export class LMSAccessTokenModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  userId: number;

  @Exclude()
  @Column({ type: 'text', nullable: true })
  iv?: string;

  @Exclude()
  @Column({ type: 'text', nullable: true })
  data?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  encryptedAt: Date;

  @Exclude()
  @ManyToOne(() => UserModel, (user) => user.lmsAccessTokens, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  @Exclude()
  @ManyToOne(
    () => LMSOrganizationIntegrationModel,
    (integration) => integration.userAccessTokens,
    { onDelete: 'CASCADE' },
  )
  organizationIntegration: LMSOrganizationIntegrationModel;

  @Exclude()
  @OneToMany(() => LMSCourseIntegrationModel, (course) => course.accessToken)
  courses: LMSCourseIntegrationModel[];

  async encryptToken(raw: LMSPostResponseBody): Promise<LMSAccessTokenModel> {
    const endec = this.getEndec();

    const token: LMSAccessToken = {
      ...raw,
      userId: raw.user.id,
    };

    Object.keys(token).forEach((k0) => {
      if (!Object.keys(new LMSAccessToken()).includes(k0)) {
        delete token[k0];
      }
    });

    const { data, iv } = await endec.encrypt(token);
    this.iv = iv;
    this.data = data;
    // Subtract a minute, give or take, for the new encrypted date
    this.encryptedAt = new Date(Date.now() - 60 * 1000);

    return await LMSAccessTokenModel.save(this);
  }

  isExpired(token: LMSAccessToken) {
    return (Date.now() - this.encryptedAt.getTime()) / 1000 > token.expires_in;
  }

  async getToken(): Promise<LMSAccessToken> {
    const endec = this.getEndec();
    if (!this.data || !this.iv) {
      throw new BadRequestException(ERROR_MESSAGES.lmsAdapter.tokenEmpty);
    }
    return await endec.decrypt(this.data, this.iv);
  }

  getEndec() {
    return LMSAccessTokenModel.getEndec(this.organizationIntegration);
  }

  static getEndec(
    organizationIntegration: LMSOrganizationIntegrationModel,
  ): DataEndec {
    if (!organizationIntegration.clientSecret) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsAdapter.missingClientSecret,
      );
    }
    return new DataEndec(organizationIntegration.clientSecret);
  }
}
