import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpgradeTypeorm1745449131715 implements MigrationInterface {
  name = 'UpgradeTypeorm1745449131715';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" DROP CONSTRAINT "FK_1e4a83bab6e8e701425f3461b04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ADD "queueSize" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD "name" character varying GENERATED ALWAYS AS (COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')) STORED NOT NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'dev',
        'public',
        'user_model',
        'GENERATED_COLUMN',
        'name',
        "COALESCE(\"firstName\", '') || ' ' || COALESCE(\"lastName\", '')",
      ],
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ALTER COLUMN "name" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ALTER COLUMN "name" SET DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" DROP CONSTRAINT "FK_4666f20b8ec1107f9973e966062"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" DROP CONSTRAINT "UQ_4666f20b8ec1107f9973e966062"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_594c79fce72d04560c3a4465ea6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_model" DROP CONSTRAINT "FK_3aee17cf9fc085e98b2b8607071"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_announcement_model" DROP CONSTRAINT "FK_dc5e29602b03151c340c596f7ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "UQ_594c79fce72d04560c3a4465ea6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP CONSTRAINT "UQ_0b8c46d3c880227af25ce517ee2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ADD CONSTRAINT "FK_1e4a83bab6e8e701425f3461b04" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD CONSTRAINT "FK_4666f20b8ec1107f9973e966062" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_model" ADD CONSTRAINT "FK_3aee17cf9fc085e98b2b8607071" FOREIGN KEY ("courseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_announcement_model" ADD CONSTRAINT "FK_dc5e29602b03151c340c596f7ae" FOREIGN KEY ("courseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_594c79fce72d04560c3a4465ea6" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_594c79fce72d04560c3a4465ea6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_announcement_model" DROP CONSTRAINT "FK_dc5e29602b03151c340c596f7ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_model" DROP CONSTRAINT "FK_3aee17cf9fc085e98b2b8607071"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" DROP CONSTRAINT "FK_4666f20b8ec1107f9973e966062"`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" DROP CONSTRAINT "FK_1e4a83bab6e8e701425f3461b04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD CONSTRAINT "UQ_0b8c46d3c880227af25ce517ee2" UNIQUE ("courseId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "UQ_594c79fce72d04560c3a4465ea6" UNIQUE ("courseId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_announcement_model" ADD CONSTRAINT "FK_dc5e29602b03151c340c596f7ae" FOREIGN KEY ("courseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_model" ADD CONSTRAINT "FK_3aee17cf9fc085e98b2b8607071" FOREIGN KEY ("courseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_594c79fce72d04560c3a4465ea6" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD CONSTRAINT "UQ_4666f20b8ec1107f9973e966062" UNIQUE ("queueId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD CONSTRAINT "FK_4666f20b8ec1107f9973e966062" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ALTER COLUMN "name" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ALTER COLUMN "name" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ALTER COLUMN "userId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`,
      ['GENERATED_COLUMN', 'name', 'dev', 'public', 'user_model'],
    );
    await queryRunner.query(`ALTER TABLE "user_model" DROP COLUMN "name"`);
    await queryRunner.query(
      `ALTER TABLE "queue_model" DROP COLUMN "queueSize"`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ADD CONSTRAINT "FK_1e4a83bab6e8e701425f3461b04" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
