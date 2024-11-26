import { MigrationInterface, QueryRunner } from 'typeorm';

export class addQueueChatsModel1729618105742 implements MigrationInterface {
  name = 'addQueueChatsModel1729618105742';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "queue_chats_model" ("id" SERIAL NOT NULL, "queueId" integer, "staffId" integer, "studentId" integer, "startedAt" TIMESTAMP WITH TIME ZONE, "closedAt" TIMESTAMP WITH TIME ZONE DEFAULT now(), "messageCount" integer, CONSTRAINT "PK_9bce276ec6b0c63f3b1da4cfafb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_chats_model" ADD CONSTRAINT "FK_56fd8f661af1cd36157f566a5ef" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_chats_model" ADD CONSTRAINT "FK_4fc95f34a9b3b195e749daffd39" FOREIGN KEY ("staffId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_chats_model" ADD CONSTRAINT "FK_341177e4638e8543b80eb549041" FOREIGN KEY ("studentId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "queue_chats_model" DROP CONSTRAINT "FK_341177e4638e8543b80eb549041"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_chats_model" DROP CONSTRAINT "FK_4fc95f34a9b3b195e749daffd39"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_chats_model" DROP CONSTRAINT "FK_56fd8f661af1cd36157f566a5ef"`,
    );
    await queryRunner.query(`DROP TABLE "queue_chats_model"`);
  }
}
