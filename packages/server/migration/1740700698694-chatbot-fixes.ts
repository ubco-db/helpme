import { MigrationInterface, QueryRunner } from 'typeorm';

export class chatbotFixes1740700698694 implements MigrationInterface {
  name = 'chatbotFixes1740700698694';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP COLUMN "interactionId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD "interactionId" integer`,
    );
  }
}
