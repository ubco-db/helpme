import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoodbyeOllama1787970933955 implements MigrationInterface {
  name = 'GoodbyeOllama1787970933955';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."chatbot_provider_model_providertype_enum" RENAME TO "chatbot_provider_model_providertype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chatbot_provider_model_providertype_enum" AS ENUM('openai', 'local_llm')`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_provider_model" ALTER COLUMN "providerType" TYPE "public"."chatbot_provider_model_providertype_enum" USING (CASE WHEN "providerType"::"text" = 'ollama' THEN 'local_llm' ELSE "providerType"::"text" END)::"public"."chatbot_provider_model_providertype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."chatbot_provider_model_providertype_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."chatbot_provider_model_providertype_enum_old" AS ENUM('openai', 'ollama')`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_provider_model" ALTER COLUMN "providerType" TYPE "public"."chatbot_provider_model_providertype_enum_old" USING (CASE WHEN "providerType"::"text" = 'local_llm' THEN 'ollama' ELSE "providerType"::"text" END)::"public"."chatbot_provider_model_providertype_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."chatbot_provider_model_providertype_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."chatbot_provider_model_providertype_enum_old" RENAME TO "chatbot_provider_model_providertype_enum"`,
    );
  }
}
