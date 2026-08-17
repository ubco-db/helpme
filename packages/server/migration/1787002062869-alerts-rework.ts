import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsRework1787002062869 implements MigrationInterface {
  name = 'AlertsRework1787002062869';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP CONSTRAINT "FK_d0a57d15e4e5c1ac71886fb4409"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" RENAME COLUMN "sent" TO "sentAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "sentAt" TYPE TIMESTAMP WITH TIME ZONE USING "sentAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "sentAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" RENAME COLUMN "resolved" TO "readAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "readAt" TYPE TIMESTAMP WITH TIME ZONE USING "readAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_deliverymode_enum" AS ENUM('modal', 'feed', 'toast')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ADD "deliveryMode" "public"."alert_model_deliverymode_enum" NOT NULL DEFAULT 'modal'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."alert_model_alerttype_enum" RENAME TO "alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum" AS ENUM('rephraseQuestion', 'eventEndedCheckoutStaff', 'promptStudentToLeaveQueue', 'chatbotDocumentProcessed', 'courseCloned', 'asyncQuestionUpdate', 'adminNotice')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "alertType" TYPE "public"."alert_model_alerttype_enum" USING "alertType"::"text"::"public"."alert_model_alerttype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "payload" TYPE jsonb USING "payload"::text::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_d0a57d15e4e5c1ac71886fb4409" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7" FOREIGN KEY ("interaction") REFERENCES "chatbot_interactions_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP CONSTRAINT "FK_d0a57d15e4e5c1ac71886fb4409"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "payload" TYPE json USING "payload"::text::json`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum_old" AS ENUM('eventEndedCheckoutStaff', 'promptStudentToLeaveQueue', 'rephraseQuestion')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "alertType" TYPE "public"."alert_model_alerttype_enum_old" USING "alertType"::"text"::"public"."alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."alert_model_alerttype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."alert_model_alerttype_enum_old" RENAME TO "alert_model_alerttype_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" DROP COLUMN "deliveryMode"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."alert_model_deliverymode_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "readAt" TYPE TIMESTAMP USING "readAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" RENAME COLUMN "readAt" TO "resolved"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "sentAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "sentAt" TYPE TIMESTAMP USING "sentAt" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" RENAME COLUMN "sentAt" TO "sent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7" FOREIGN KEY ("interaction") REFERENCES "chatbot_interactions_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_d0a57d15e4e5c1ac71886fb4409" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
