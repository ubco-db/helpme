import { MigrationInterface, QueryRunner } from 'typeorm';

export class changeCourseFKConstraintToSetNullSemester1740984396325
  implements MigrationInterface
{
  name = 'changeCourseFKConstraintToSetNullSemester1740984396325';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "FK_34820ed355fa20cb6037e9cab78"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "FK_34820ed355fa20cb6037e9cab78" FOREIGN KEY ("semesterId") REFERENCES "semester_model"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "FK_34820ed355fa20cb6037e9cab78"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "FK_34820ed355fa20cb6037e9cab78" FOREIGN KEY ("semesterId") REFERENCES "semester_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
