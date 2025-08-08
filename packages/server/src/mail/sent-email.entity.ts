import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { EmailMetadata, MailServiceType } from '@koh/common';

// Need to save email ids in order to be able to reply to emails sent earlier (e.g. to reply that an anytime question already received help)
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
}
