import { MigrationInterface, QueryRunner } from 'typeorm';

export class addedVotesTable1710429563895 implements MigrationInterface {
  name = 'addedVotesTable1710429563895';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "async_question_votes_model" ("id" SERIAL NOT NULL, "userId" integer, "questionId" integer, "vote" integer NOT NULL, CONSTRAINT "PK_1325449725853fd33254b3ecb9f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP COLUMN "votes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" ADD CONSTRAINT "FK_001cf9c56d1fa2cb4d0963aecbb" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" ADD CONSTRAINT "FK_eb178f187843117070809c574ed" FOREIGN KEY ("questionId") REFERENCES "async_question_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" DROP CONSTRAINT "FK_eb178f187843117070809c574ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" DROP CONSTRAINT "FK_001cf9c56d1fa2cb4d0963aecbb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD "votes" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`DROP TABLE "async_question_votes_model"`);
  }
}
