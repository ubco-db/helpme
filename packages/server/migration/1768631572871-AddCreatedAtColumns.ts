import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatedAtColumns1768631572871 implements MigrationInterface {
  name = 'AddCreatedAtColumns1768631572871';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_staff_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_staff_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_model" ALTER COLUMN "createdAt" SET DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_model" ALTER COLUMN "createdAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(`ALTER TABLE "user_model" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "queue_staff_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP COLUMN "createdAt"`,
    );
  }
}
