import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';

@Entity('lms_course_integration_model')
export class LMSCourseIntegrationModel extends BaseEntity {
  @PrimaryColumn()
  courseId: number;

  @Column({ type: 'text' })
  apiCourseId: string;

  @Column({ type: 'text' })
  apiKey: string;

  @Column({ type: 'datetime' })
  apiKeyExpiry: Date;

  @ManyToOne(
    (type) => LMSOrganizationIntegrationModel,
    (integration) => integration.integrations,
  )
  orgIntegration: LMSOrganizationIntegrationModel;
}
