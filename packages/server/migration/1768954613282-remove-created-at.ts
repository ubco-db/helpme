import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCreatedAt1768954613282 implements MigrationInterface {
  name = 'RemoveCreatedAt1768954613282';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
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
