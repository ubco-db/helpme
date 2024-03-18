import { MigrationInterface, QueryRunner } from 'typeorm';

export class updateCourseSettings1710367338381 implements MigrationInterface {
  name = 'updateCourseSettings1710367338381';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD CONSTRAINT "UQ_0b8c46d3c880227af25ce517ee2" UNIQUE ("courseId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP CONSTRAINT "UQ_0b8c46d3c880227af25ce517ee2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
