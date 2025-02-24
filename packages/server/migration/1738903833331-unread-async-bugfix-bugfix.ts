import { MigrationInterface, QueryRunner } from 'typeorm';

export class unreadAsyncBugfixBugfix1738903833331
  implements MigrationInterface
{
  name = 'unreadAsyncBugfixBugfix1738903833331';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "unread_async_question_model" ("courseId" integer NOT NULL, "userId" integer NOT NULL, "asyncQuestionId" integer NOT NULL, "readLatest" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_d8b60ea5f9630ed787c3a759df1" PRIMARY KEY ("courseId", "userId", "asyncQuestionId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "unread_async_question_model" ADD CONSTRAINT "FK_7897441589b74c28b74e1c6f9f6" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "unread_async_question_model" ADD CONSTRAINT "FK_50d2b1356ac241475c1a1c74c6b" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "unread_async_question_model" ADD CONSTRAINT "FK_ede1abbedcf8007963b17b004d0" FOREIGN KEY ("asyncQuestionId") REFERENCES "async_question_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "unread_async_question_model" DROP CONSTRAINT "FK_ede1abbedcf8007963b17b004d0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unread_async_question_model" DROP CONSTRAINT "FK_50d2b1356ac241475c1a1c74c6b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unread_async_question_model" DROP CONSTRAINT "FK_7897441589b74c28b74e1c6f9f6"`,
    );
    await queryRunner.query(`DROP TABLE "unread_async_question_model"`);
  }
}
