import { MigrationInterface, QueryRunner } from 'typeorm';

export class LmsFilesNowDefaultSynced1789111553813 implements MigrationInterface {
  name = 'LmsFilesNowDefaultSynced1789111553813';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" SET DEFAULT '{assignments,announcements,pages,files}'`,
    );

    // Update existing courses to the new default (only doing it for newer courses)
    await queryRunner.query(`
            UPDATE lms_course_integration_model
            SET "selectedResourceTypes" = '{assignments,announcements,pages,files}'
            FROM course_model
            WHERE lms_course_integration_model."courseId" = course_model.id
              AND course_model."createdAt" > NOW() - INTERVAL '2 months';
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" SET DEFAULT '{assignments,announcements,pages}'`,
    );
  }
}
