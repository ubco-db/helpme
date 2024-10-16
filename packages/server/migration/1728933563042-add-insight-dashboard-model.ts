import { MigrationInterface, QueryRunner } from 'typeorm';

export class addInsightDashboardModel1728933563042
  implements MigrationInterface
{
  name = 'addInsightDashboardModel1728933563042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "insight_dashboard_model" ("userCourseId" integer NOT NULL, "name" text NOT NULL, "insights" text NOT NULL DEFAULT '{}', CONSTRAINT "dashboardKey" UNIQUE ("name", "userCourseId"), CONSTRAINT "PK_bb78ab39d32c6d294d6ab0b3d6c" PRIMARY KEY ("userCourseId", "name"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "insight_dashboard_model" ADD CONSTRAINT "FK_c5973ea9aade467a0d46aad78f5" FOREIGN KEY ("userCourseId") REFERENCES "user_course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insight_dashboard_model" DROP CONSTRAINT "FK_c5973ea9aade467a0d46aad78f5"`,
    );
    await queryRunner.query(`DROP TABLE "insight_dashboard_model"`);
  }
}
