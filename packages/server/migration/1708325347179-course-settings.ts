import { MigrationInterface, QueryRunner } from 'typeorm';

export class courseSettings1708325347179 implements MigrationInterface {
  name = 'courseSettings1708325347179';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "course_settings_model" ("courseId" integer NOT NULL, "chatBotEnabled" boolean NOT NULL DEFAULT true, "asyncQueueEnabled" boolean NOT NULL DEFAULT true, "adsEnabled" boolean NOT NULL DEFAULT true, "queueEnabled" boolean NOT NULL DEFAULT true, CONSTRAINT "REL_0b8c46d3c880227af25ce517ee" UNIQUE ("courseId"), CONSTRAINT "PK_0b8c46d3c880227af25ce517ee2" PRIMARY KEY ("courseId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2"`,
    );
    await queryRunner.query(`DROP TABLE "course_settings_model"`);
  }
}
