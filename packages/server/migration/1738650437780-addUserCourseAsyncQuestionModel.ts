import { MigrationInterface, QueryRunner } from 'typeorm';

export class addUserCourseAsyncQuestionModel1738650437780
  implements MigrationInterface
{
  name = 'addUserCourseAsyncQuestionModel1738650437780';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_course_async_model" ("id" SERIAL NOT NULL, "userCourseId" integer, "asyncQuestionId" integer, "readLatest" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_51d65ed3335832028b91d15a05e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_async_model" ADD CONSTRAINT "FK_06fe865e60aee7680eb34e72986" FOREIGN KEY ("userCourseId") REFERENCES "user_course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_async_model" ADD CONSTRAINT "FK_af90063fff427e12c9acc1ecd3d" FOREIGN KEY ("asyncQuestionId") REFERENCES "async_question_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_async_model" DROP CONSTRAINT "FK_af90063fff427e12c9acc1ecd3d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_async_model" DROP CONSTRAINT "FK_06fe865e60aee7680eb34e72986"`,
    );
    await queryRunner.query(`DROP TABLE "user_course_async_model"`);
  }
}
