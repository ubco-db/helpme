import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('lti_config_model')
export class LTIConfigModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', unique: true })
  url: string;

  @Column({ type: 'text' })
  iss: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  clientId?: string;

  @Column({ type: 'text' })
  authenticationEndpoint: string;

  @Column({ type: 'text' })
  accesstokenEndpoint: string;

  @Column({ type: 'text' })
  keysetEndpoint: string;

  @Column({ type: 'integer', array: true, default: [] })
  organizations: number[];
}
