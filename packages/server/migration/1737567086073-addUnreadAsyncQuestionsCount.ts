import { MigrationInterface, QueryRunner } from 'typeorm';

export class addUnreadAsyncQuestionsCount1737567086073
  implements MigrationInterface
{
  name = 'addUnreadAsyncQuestionsCount1737567086073';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD "unreadAsyncQuestions" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP COLUMN "unreadAsyncQuestions"`,
    );
  }
}
