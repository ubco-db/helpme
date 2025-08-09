import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotOrganizationSettings1754676952750
  implements MigrationInterface
{
  name = 'ChatbotOrganizationSettings1754676952750';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "course_chatbot_settings_model" ("id" SERIAL NOT NULL, "courseId" integer NOT NULL, "organizationSettingsId" integer NOT NULL, "llmId" integer NOT NULL, "usingDefaultModel" boolean NOT NULL DEFAULT false, "prompt" text NOT NULL DEFAULT 'You are a course help assistant for a course. Here are some rules for question answering:  1) You may use markdown for styling your answers. 2) Refer to context when you see fit. 3) Try not giving the assignment question answers directly to students, instead provide hints.', "usingDefaultPrompt" boolean NOT NULL DEFAULT false, "temperature" double precision NOT NULL DEFAULT '0.7', "usingDefaultTemperature" boolean NOT NULL DEFAULT false, "topK" double precision NOT NULL DEFAULT '5', "usingDefaultTopK" boolean NOT NULL DEFAULT false, "similarityThresholdDocuments" double precision NOT NULL DEFAULT '0.55', "usingDefaultSimilarityThresholdDocuments" boolean NOT NULL DEFAULT false, "similarityThresholdQuestions" double precision NOT NULL DEFAULT '0.9', "usingDefaultSimilarityThresholdQuestions" boolean NOT NULL DEFAULT false, CONSTRAINT "REL_47403ceb85db02238d9c63bd73" UNIQUE ("courseId"), CONSTRAINT "PK_32e53f397b88546e60c76dfa174" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "llm_type_model" ("id" SERIAL NOT NULL, "modelName" text NOT NULL, "isRecommended" boolean NOT NULL DEFAULT false, "isText" boolean NOT NULL DEFAULT true, "isVision" boolean NOT NULL DEFAULT false, "isThinking" boolean NOT NULL, "providerId" integer NOT NULL, "additionalNotes" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_22555f22c02be729f6293198192" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chatbot_provider_model_providertype_enum" AS ENUM('openai', 'ollama')`,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'dev',
        'public',
        'chatbot_provider_model',
        'GENERATED_COLUMN',
        'hasApiKey',
        '"apiKey" IS NOT NULL',
      ],
    );
    await queryRunner.query(
      `CREATE TABLE "chatbot_provider_model" ("id" SERIAL NOT NULL, "orgChatbotSettingsId" integer NOT NULL, "nickname" text, "providerType" "public"."chatbot_provider_model_providertype_enum" NOT NULL, "baseUrl" text, "apiKey" text, "hasApiKey" boolean GENERATED ALWAYS AS ("apiKey" IS NOT NULL) STORED NOT NULL, "headers" jsonb NOT NULL DEFAULT '{}', "defaultModelId" integer, "defaultVisionModelId" integer, "additionalNotes" text array NOT NULL DEFAULT '{}', CONSTRAINT "REL_d18b754a4c12736fe424e1faf6" UNIQUE ("defaultModelId"), CONSTRAINT "REL_b9093a64c9cdcd41cdf8cf412b" UNIQUE ("defaultVisionModelId"), CONSTRAINT "PK_733f40f0d4d65242cf248032e84" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_chatbot_settings_model" ("id" SERIAL NOT NULL, "organizationId" integer NOT NULL, "defaultProviderId" integer, "default_prompt" text, "default_temperature" double precision, "default_topK" double precision, "default_similarityThresholdDocuments" double precision, "default_similarityThresholdQuestions" double precision, CONSTRAINT "REL_c971bac387698bbf6c66aee4c4" UNIQUE ("organizationId"), CONSTRAINT "REL_3e7a35db35a3302e0eecdf5723" UNIQUE ("defaultProviderId"), CONSTRAINT "PK_6eb2927f945ad06330be63bd907" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD "organizationId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD CONSTRAINT "UQ_704c0609206d9a92e7d1fe74f23" UNIQUE ("organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "chatbotSettingsCourseId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "UQ_78cb4215ce3ffbc76f8071e5bb3" UNIQUE ("chatbotSettingsCourseId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" ADD CONSTRAINT "FK_47403ceb85db02238d9c63bd73f" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" ADD CONSTRAINT "FK_d8e9591901bd319fb2695309eb4" FOREIGN KEY ("organizationSettingsId") REFERENCES "organization_chatbot_settings_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" ADD CONSTRAINT "FK_85619908e9ad230386b8f1abf86" FOREIGN KEY ("llmId") REFERENCES "llm_type_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "llm_type_model" ADD CONSTRAINT "FK_688d29f8cd0aafbd945b4b12743" FOREIGN KEY ("providerId") REFERENCES "chatbot_provider_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_provider_model" ADD CONSTRAINT "FK_b9346fb706ecc30f729a34e8b51" FOREIGN KEY ("orgChatbotSettingsId") REFERENCES "organization_chatbot_settings_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_provider_model" ADD CONSTRAINT "FK_d18b754a4c12736fe424e1faf62" FOREIGN KEY ("defaultModelId") REFERENCES "llm_type_model"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_provider_model" ADD CONSTRAINT "FK_b9093a64c9cdcd41cdf8cf412b0" FOREIGN KEY ("defaultVisionModelId") REFERENCES "llm_type_model"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_chatbot_settings_model" ADD CONSTRAINT "FK_c971bac387698bbf6c66aee4c4f" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_chatbot_settings_model" ADD CONSTRAINT "FK_3e7a35db35a3302e0eecdf57239" FOREIGN KEY ("defaultProviderId") REFERENCES "chatbot_provider_model"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD CONSTRAINT "FK_704c0609206d9a92e7d1fe74f23" FOREIGN KEY ("organizationId") REFERENCES "organization_chatbot_settings_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "FK_78cb4215ce3ffbc76f8071e5bb3" FOREIGN KEY ("chatbotSettingsCourseId") REFERENCES "course_chatbot_settings_model"("courseId") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "FK_78cb4215ce3ffbc76f8071e5bb3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP CONSTRAINT "FK_704c0609206d9a92e7d1fe74f23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_chatbot_settings_model" DROP CONSTRAINT "FK_3e7a35db35a3302e0eecdf57239"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_chatbot_settings_model" DROP CONSTRAINT "FK_c971bac387698bbf6c66aee4c4f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_provider_model" DROP CONSTRAINT "FK_b9093a64c9cdcd41cdf8cf412b0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_provider_model" DROP CONSTRAINT "FK_d18b754a4c12736fe424e1faf62"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_provider_model" DROP CONSTRAINT "FK_b9346fb706ecc30f729a34e8b51"`,
    );
    await queryRunner.query(
      `ALTER TABLE "llm_type_model" DROP CONSTRAINT "FK_688d29f8cd0aafbd945b4b12743"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" DROP CONSTRAINT "FK_85619908e9ad230386b8f1abf86"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" DROP CONSTRAINT "FK_d8e9591901bd319fb2695309eb4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" DROP CONSTRAINT "FK_47403ceb85db02238d9c63bd73f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "UQ_78cb4215ce3ffbc76f8071e5bb3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "chatbotSettingsCourseId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP CONSTRAINT "UQ_704c0609206d9a92e7d1fe74f23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP COLUMN "organizationId"`,
    );
    await queryRunner.query(`DROP TABLE "organization_chatbot_settings_model"`);
    await queryRunner.query(`DROP TABLE "chatbot_provider_model"`);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`,
      [
        'GENERATED_COLUMN',
        'hasApiKey',
        'dev',
        'public',
        'chatbot_provider_model',
      ],
    );
    await queryRunner.query(
      `DROP TYPE "public"."chatbot_provider_model_providertype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "llm_type_model"`);
    await queryRunner.query(`DROP TABLE "course_chatbot_settings_model"`);
  }
}
