import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('slack_link_codes')
export class SlackLinkCodeModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200, unique: true })
  code: string;

  @Column()
  userId: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;
}
