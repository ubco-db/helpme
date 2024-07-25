import { MigrationInterface, QueryRunner } from 'typeorm';

export class studentTaskProgressHotfix1720833548372
  implements MigrationInterface
{
  name = 'studentTaskProgressHotfix1720833548372';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" DROP CONSTRAINT "FK_e855cab9855b51519940f751262"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" DROP CONSTRAINT "FK_00d27c247661185ee5c46b03412"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" ADD CONSTRAINT "FK_e855cab9855b51519940f751262" FOREIGN KEY ("uid") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" ADD CONSTRAINT "FK_00d27c247661185ee5c46b03412" FOREIGN KEY ("cid") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "student_task_progress_model" ADD CONSTRAINT "FK_00d27c247661185ee5c46b03412" FOREIGN KEY ("cid") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" ADD CONSTRAINT "FK_e855cab9855b51519940f751262" FOREIGN KEY ("uid") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
