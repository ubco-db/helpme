import { MigrationInterface, QueryRunner } from 'typeorm';

export class configModel1717880186425 implements MigrationInterface {
  name = 'configModel1717880186425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "config_model" ("id" SERIAL NOT NULL, "max_async_questions" bigint NOT NULL DEFAULT '100', "max_queues_per_course" bigint NOT NULL DEFAULT '30', "max_question_types_per_queue" bigint NOT NULL DEFAULT '20', "max_questions_per_queue" bigint NOT NULL DEFAULT '30', "max_semesters" bigint NOT NULL DEFAULT '40', CONSTRAINT "PK_bdb17f3848b5e161e7867afec72" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "config_model"`);
  }
}
