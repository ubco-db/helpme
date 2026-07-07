import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotAgentCourseGroups1781721021662
  implements MigrationInterface
{
  name = 'ChatbotAgentCourseGroups1781721021662';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "FK_e14a9e2f182848bb9069989d7bb"`,
    );
    await queryRunner.query(
      `CREATE TABLE "super_course_course_model" ("superCourseId" integer NOT NULL, "courseId" integer NOT NULL, CONSTRAINT "PK_3e69eae568ce0a798c90af36108" PRIMARY KEY ("superCourseId", "courseId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_84a343766d5ed10b93bb3d0687" ON "super_course_course_model" ("superCourseId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_424f337188cbf825994e856c7c" ON "super_course_course_model" ("courseId") `,
    );
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
      `ALTER TABLE "super_course_model" ALTER COLUMN "purpose" SET NOT NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "super_course_course_model" ("superCourseId", "courseId") SELECT "superCourseId", "id" FROM "course_model" WHERE "superCourseId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "superCourseId"`,
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
      `ALTER TABLE "super_course_course_model" ADD CONSTRAINT "FK_84a343766d5ed10b93bb3d06872" FOREIGN KEY ("superCourseId") REFERENCES "super_course_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_course_course_model" ADD CONSTRAINT "FK_424f337188cbf825994e856c7c2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "super_course_course_model" DROP CONSTRAINT "FK_424f337188cbf825994e856c7c2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_course_course_model" DROP CONSTRAINT "FK_84a343766d5ed10b93bb3d06872"`,
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
      `ALTER TABLE "super_course_model" DROP COLUMN "purpose"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."super_course_model_purpose_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "superCourseId" integer`,
    );
    await queryRunner.query(
      `UPDATE "course_model" SET "superCourseId" = "superCourse"."superCourseId" FROM (SELECT DISTINCT ON ("courseId") "courseId", "superCourseId" FROM "super_course_course_model" ORDER BY "courseId", "superCourseId") "superCourse" WHERE "course_model"."id" = "superCourse"."courseId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_424f337188cbf825994e856c7c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_84a343766d5ed10b93bb3d0687"`,
    );
    await queryRunner.query(`DROP TABLE "super_course_course_model"`);
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "FK_e14a9e2f182848bb9069989d7bb" FOREIGN KEY ("superCourseId") REFERENCES "super_course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
