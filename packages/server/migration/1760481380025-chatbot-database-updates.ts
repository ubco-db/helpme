import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotDatabaseUpdates1760481380025 implements MigrationInterface {
  name = 'ChatbotDatabaseUpdates1760481380025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_8db2901f8e702975574c1579bad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_7df3546203b677c555f27974c25"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP COLUMN "suggested"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP COLUMN "questionText"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP COLUMN "responseText"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" RENAME COLUMN "course" TO "courseId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" RENAME COLUMN "user" TO "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" RENAME COLUMN "interaction" TO "interactionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ALTER COLUMN "vectorStoreId" TYPE TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ALTER COLUMN "timestamp" TYPE TIMESTAMP WITH TIME ZONE USING "timestamp" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ALTER COLUMN "timestamp" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD CONSTRAINT "FK_797cfec9399d72f1b554d7cb56c" FOREIGN KEY ("interactionId") REFERENCES "chatbot_interactions_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_2d37ae2602e60432a4bf0c3cb19" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_2b01cc936a843e5efc73f9acf49" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_2b01cc936a843e5efc73f9acf49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_2d37ae2602e60432a4bf0c3cb19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP CONSTRAINT "FK_797cfec9399d72f1b554d7cb56c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ALTER COLUMN "timestamp" TYPE TIMESTAMP USING "timestamp"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ALTER COLUMN "timestamp" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ALTER COLUMN "vectorStoreId" TYPE CHARACTER VARYING`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" RENAME COLUMN "userId" TO "user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" RENAME COLUMN "courseId" TO "course"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" RENAME COLUMN "interactionId" TO "interaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD "responseText" TEXT NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD "questionText" TEXT NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD "suggested" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_7df3546203b677c555f27974c25" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_8db2901f8e702975574c1579bad" FOREIGN KEY ("user") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7" FOREIGN KEY ("interaction") REFERENCES "chatbot_interactions_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
