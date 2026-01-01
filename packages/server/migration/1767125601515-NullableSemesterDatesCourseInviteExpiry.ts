import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableSemesterDatesCourseInviteExpiry1767125601515
  implements MigrationInterface
{
  name = 'NullableSemesterDatesCourseInviteExpiry1767125601515';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_invite_model" RENAME COLUMN "expires" TO "expiresInSeconds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "startDate" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "endDate" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "endDate" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "startDate" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_invite_model" RENAME COLUMN "expiresInSeconds" TO "expires"`,
    );
  }
}
