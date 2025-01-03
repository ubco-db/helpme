import { MigrationInterface, QueryRunner } from 'typeorm';

export class addUnreadAsyncQuestionsCountColumnToUserCourseModel1733250777951
  implements MigrationInterface
{
  name = 'addUnreadAsyncQuestionsCountColumnToUserCourseModel1733250777951';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD "unreadAsyncQuestions" integer DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP COLUMN "unreadAsyncQuestions"`,
    );
  }
}
