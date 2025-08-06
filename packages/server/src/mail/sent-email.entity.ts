import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { MailServiceModel } from './mail-services.entity';
import { EmailMetadata, MailServiceType } from '@koh/common';

@Entity('sent_email_model')
export class SentEmailModel extends BaseEntity {
  @PrimaryColumn({ type: 'text' })
  emailId: string;

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'text', array: true, default: [] })
  accepted: string[];

  @Column({ type: 'text', array: true, default: [] })
  rejected: string[];

  @Column({ type: 'jsonb', default: {} })
  metadata: EmailMetadata;

  @Column({
    type: 'enum',
    enum: MailServiceType,
  })
  serviceType: MailServiceType;

  @ManyToOne(() => MailServiceModel, (msm) => msm.sentEmails)
  @JoinColumn({ name: 'serviceType' })
  mailService: MailServiceModel;
}
