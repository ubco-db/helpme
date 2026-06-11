import { MigrationInterface, QueryRunner } from 'typeorm';

export class courseInviteEnabledFlag1759000000000
  implements MigrationInterface
{
  name = 'courseInviteEnabledFlag1759000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "isCourseInviteEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "course_model" SET "isCourseInviteEnabled" = TRUE WHERE "courseInviteCode" IS NOT NULL AND "courseInviteCode" != ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "isCourseInviteEnabled"`,
    );
  }
}
