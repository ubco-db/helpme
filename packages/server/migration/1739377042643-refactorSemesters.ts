import { MigrationInterface, QueryRunner } from 'typeorm';

export class refactorSemesters1739377042643 implements MigrationInterface {
  name = 'refactorSemesters1739377042643';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "season"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "name" text NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "startMonth" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "endMonth" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "courseId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "organizationId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD CONSTRAINT "FK_dfc876895413b140d62760ee03d" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP CONSTRAINT "FK_dfc876895413b140d62760ee03d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "organizationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "courseId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "endMonth"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "startMonth"`,
    );
    await queryRunner.query(`ALTER TABLE "semester_model" DROP COLUMN "name"`);
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "season" text NOT NULL`,
    );
  }
}
