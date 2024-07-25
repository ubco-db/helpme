import { MigrationInterface, QueryRunner } from 'typeorm';

export class questionTypeFixes1718772955466 implements MigrationInterface {
  name = 'questionTypeFixes1718772955466';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD CONSTRAINT "FK_a3ecde22b20f0416affdad4d0d3" FOREIGN KEY ("cid") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP CONSTRAINT "FK_a3ecde22b20f0416affdad4d0d3"`,
    );
  }
}
