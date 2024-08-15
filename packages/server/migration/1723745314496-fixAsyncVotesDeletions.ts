import { MigrationInterface, QueryRunner } from 'typeorm';

export class fixAsyncVotesDeletions1723745314496 implements MigrationInterface {
  name = 'fixAsyncVotesDeletions1723745314496';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" DROP CONSTRAINT "FK_eb178f187843117070809c574ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" DROP CONSTRAINT "FK_001cf9c56d1fa2cb4d0963aecbb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" ADD CONSTRAINT "FK_001cf9c56d1fa2cb4d0963aecbb" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" ADD CONSTRAINT "FK_eb178f187843117070809c574ed" FOREIGN KEY ("questionId") REFERENCES "async_question_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "async_question_votes_model" ADD CONSTRAINT "FK_001cf9c56d1fa2cb4d0963aecbb" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" ADD CONSTRAINT "FK_eb178f187843117070809c574ed" FOREIGN KEY ("questionId") REFERENCES "async_question_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
