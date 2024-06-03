import { MigrationInterface, QueryRunner } from 'typeorm';

export class configTaskProgress1717380378232 implements MigrationInterface {
  name = 'configTaskProgress1717380378232';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "student_task_progress_model" ("taskProgress" json NOT NULL, "uid" integer NOT NULL, "cid" integer NOT NULL, CONSTRAINT "PK_4dd97a62b3d704dcd4cba229735" PRIMARY KEY ("uid", "cid"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_model" DROP COLUMN "phoneNotifsEnabled"`,
    );
    await queryRunner.query(`ALTER TABLE "queue_model" ADD "config" json`);
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD "isTaskQuestion" boolean NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" ADD CONSTRAINT "FK_e855cab9855b51519940f751262" FOREIGN KEY ("uid") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" ADD CONSTRAINT "FK_00d27c247661185ee5c46b03412" FOREIGN KEY ("cid") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" DROP CONSTRAINT "FK_00d27c247661185ee5c46b03412"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" DROP CONSTRAINT "FK_e855cab9855b51519940f751262"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP COLUMN "isTaskQuestion"`,
    );
    await queryRunner.query(`ALTER TABLE "queue_model" DROP COLUMN "config"`);
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD "phoneNotifsEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`DROP TABLE "student_task_progress_model"`);
  }
}
