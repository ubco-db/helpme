import { MigrationInterface, QueryRunner } from 'typeorm';

export class addEndorsedCommentCount1773100000000 implements MigrationInterface {
  name = 'addEndorsedCommentCount1773100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD "endorsedCommentCount" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP COLUMN "endorsedCommentCount"`,
    );
  }
}
