import { MigrationInterface, QueryRunner } from 'typeorm';

export class chatbotAgentCourseGroups1780375600000
  implements MigrationInterface
{
  name = 'chatbotAgentCourseGroups1780375600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."super_course_model_purpose_enum" AS ENUM('course_clone_group', 'chatbot_agent_group')`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_course_model" ADD "purpose" "public"."super_course_model_purpose_enum"`,
    );
    await queryRunner.query(
      `UPDATE "super_course_model" SET "purpose" = 'course_clone_group' WHERE "purpose" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "super_course_course_model" ("superCourseId" integer NOT NULL, "courseId" integer NOT NULL, CONSTRAINT "PK_a4a7c2f24fd40c99fbe5887a486" PRIMARY KEY ("superCourseId", "courseId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e7374902f82cc8791de93eb2bc" ON "super_course_course_model" ("superCourseId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_533a47344e8abf0ba9be28ded7" ON "super_course_course_model" ("courseId") `,
    );
    await queryRunner.query(
      `INSERT INTO "super_course_course_model" ("superCourseId", "courseId") SELECT "superCourseId", "id" FROM "course_model" WHERE "superCourseId" IS NOT NULL ON CONFLICT DO NOTHING`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "chatbotAgentName" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "chatbotAgentDescription" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "chatbotAgentOrder" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_course_course_model" ADD CONSTRAINT "FK_e7374902f82cc8791de93eb2bce" FOREIGN KEY ("superCourseId") REFERENCES "super_course_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_course_course_model" ADD CONSTRAINT "FK_533a47344e8abf0ba9be28ded7e" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "super_course_course_model" DROP CONSTRAINT "FK_533a47344e8abf0ba9be28ded7e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_course_course_model" DROP CONSTRAINT "FK_e7374902f82cc8791de93eb2bce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "chatbotAgentOrder"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "chatbotAgentDescription"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "chatbotAgentName"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_533a47344e8abf0ba9be28ded7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e7374902f82cc8791de93eb2bc"`,
    );
    await queryRunner.query(`DROP TABLE "super_course_course_model"`);
    await queryRunner.query(
      `ALTER TABLE "super_course_model" DROP COLUMN "purpose"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."super_course_model_purpose_enum"`,
    );
  }
}
