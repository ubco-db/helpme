import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatedAtVarious1768954613282 implements MigrationInterface {
  name = 'AddCreatedAtVarious1768954613282';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    // Set legacy data created_at to null. To be extra careful, it only does it where createdAt is +/- 1 hour from now().
    await queryRunner.query(
      `UPDATE "user_course_model" SET "createdAt" = null WHERE "createdAt" BETWEEN (now() - INTERVAL '1 hour') AND (now() + INTERVAL '1 hour')`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "question_type_model" SET "createdAt" = null WHERE "createdAt" BETWEEN (now() - INTERVAL '1 hour') AND (now() + INTERVAL '1 hour')`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "queue_invite_model" SET "createdAt" = null WHERE "createdAt" BETWEEN (now() - INTERVAL '1 hour') AND (now() + INTERVAL '1 hour')`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "queue_model" SET "createdAt" = null WHERE "createdAt" BETWEEN (now() - INTERVAL '1 hour') AND (now() + INTERVAL '1 hour')`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "semester_model" SET "createdAt" = null WHERE "createdAt" BETWEEN (now() - INTERVAL '1 hour') AND (now() + INTERVAL '1 hour')`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "organization_model" SET "createdAt" = null WHERE "createdAt" BETWEEN (now() - INTERVAL '1 hour') AND (now() + INTERVAL '1 hour')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "user_model" SET "createdAt" = null WHERE "createdAt" BETWEEN (now() - INTERVAL '1 hour') AND (now() + INTERVAL '1 hour')`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "course_model" SET "createdAt" = null WHERE "createdAt" BETWEEN (now() - INTERVAL '1 hour') AND (now() + INTERVAL '1 hour')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(`ALTER TABLE "user_model" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP COLUMN "createdAt"`,
    );
  }
}
