import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatTokenIncreaseDefaultCap1790644104629 implements MigrationInterface {
  name = 'ChatTokenIncreaseDefaultCap1790644104629';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_token_model" ALTER COLUMN "max_uses" SET DEFAULT '300'`,
    );
    // setting to 299 just to make it easy to reverse if I need to right away. Though obviously with the new cap set to 300, the `down()` won't reverse the cap for any new students.
    await queryRunner.query(
      `UPDATE "chat_token_model" SET "max_uses" = '299' WHERE "max_uses" = '30'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "chat_token_model" SET "max_uses" = '30' WHERE "max_uses" = '299'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_token_model" ALTER COLUMN "max_uses" SET DEFAULT '30'`,
    );
  }
}
