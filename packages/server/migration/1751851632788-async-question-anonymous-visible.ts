import { MigrationInterface, QueryRunner } from 'typeorm';

export class AsyncQuestionAnonymousVisible1751851632788
  implements MigrationInterface
{
  name = 'AsyncQuestionAnonymousVisible1751851632788';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "async_question_comment_model" ADD "isAnonymous" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD "authorSetVisible" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD "staffSetVisible" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD "isAnonymous" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD "asyncCentreDefaultAnonymous" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD "asyncCentreAuthorPublic" boolean NOT NULL DEFAULT false
    `,
    );
    await queryRunner.query(
      `UPDATE "async_question_model" SET "staffSetVisible" = "visible"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP COLUMN "visible"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD "visible" boolean`,
    );
    await queryRunner.query(
      `UPDATE "async_question_model" SET "visible" = "staffSetVisible"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP COLUMN "asyncCentreDefaultAnonymous"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP COLUMN "asyncCentreAuthorPublic"
    `,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP COLUMN "isAnonymous"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP COLUMN "staffSetVisible"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP COLUMN "authorSetVisible"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_comment_model" DROP COLUMN "isAnonymous"`,
    );
  }
}
