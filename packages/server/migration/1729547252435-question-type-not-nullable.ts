import { MigrationInterface, QueryRunner } from 'typeorm';

export class questionTypeNotNullable1729547252435
  implements MigrationInterface
{
  name = 'questionTypeNotNullable1729547252435';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP CONSTRAINT "FK_a3ecde22b20f0416affdad4d0d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ALTER COLUMN "cid" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ALTER COLUMN "name" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ALTER COLUMN "name" SET DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ALTER COLUMN "color" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD CONSTRAINT "FK_a3ecde22b20f0416affdad4d0d3" FOREIGN KEY ("cid") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP CONSTRAINT "FK_a3ecde22b20f0416affdad4d0d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ALTER COLUMN "color" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ALTER COLUMN "name" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ALTER COLUMN "name" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ALTER COLUMN "cid" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD CONSTRAINT "FK_a3ecde22b20f0416affdad4d0d3" FOREIGN KEY ("cid") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
