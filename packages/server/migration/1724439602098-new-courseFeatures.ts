import { MigrationInterface, QueryRunner } from 'typeorm';

export class newCourseFeatures1724439602098 implements MigrationInterface {
  name = 'newCourseFeatures1724439602098';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD "scheduleOnFrontPage" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD "asyncCentreAIAnswers" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP COLUMN "asyncCentreAIAnswers"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP COLUMN "scheduleOnFrontPage"`,
    );
  }
}
