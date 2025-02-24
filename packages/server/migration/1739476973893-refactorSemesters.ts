import { MigrationInterface, QueryRunner } from 'typeorm';

export class refactorSemesters1739476973893 implements MigrationInterface {
  name = 'refactorSemesters1739476973893';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "season"`,
    );
    await queryRunner.query(`ALTER TABLE "semester_model" DROP COLUMN "year"`);
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "name" text NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "startDate" date NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "endDate" date NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "organizationId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD CONSTRAINT "FK_dfc876895413b140d62760ee03d" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "semester_model" DROP COLUMN "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "endDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" DROP COLUMN "startDate"`,
    );
    await queryRunner.query(`ALTER TABLE "semester_model" DROP COLUMN "name"`);
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "year" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "season" text NOT NULL`,
    );
  }
}
