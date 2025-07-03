import { MigrationInterface, QueryRunner } from 'typeorm';

export class SemesterNullable1751412868191 implements MigrationInterface {
  name = 'SemesterNullable1751412868191';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prof_section_groups_model" DROP CONSTRAINT "FK_f4883601530ed63d8dcafea57d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "last_registration_model" DROP CONSTRAINT "FK_765fe567b826dd6ba406d802df6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_section_mapping_model" DROP CONSTRAINT "FK_e0c220bbfe1eaf2f8488624853d"`,
    );
    await queryRunner.query(`DROP TABLE "course_section_mapping_model"`);
    await queryRunner.query(`DROP TABLE "prof_section_groups_model"`);
    await queryRunner.query(`DROP TABLE "last_registration_model"`);
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "sectionGroupName" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "timezone" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "timezone" SET DEFAULT 'America/Los Angeles'`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "selfEnroll" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "asyncQuestionDisplayTypes" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "asyncQuestionDisplayTypes" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "selfEnroll" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "timezone" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "timezone" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ALTER COLUMN "sectionGroupName" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "last_registration_model" ("id" SERIAL NOT NULL, "profId" integer NOT NULL, "lastRegisteredSemester" text NOT NULL, CONSTRAINT "REL_765fe567b826dd6ba406d802df" UNIQUE ("profId"), CONSTRAINT "PK_6d0443f00d236b837aaf4a49726" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "prof_section_groups_model" ("id" SERIAL NOT NULL, "profId" integer NOT NULL, "sectionGroups" jsonb, CONSTRAINT "REL_f4883601530ed63d8dcafea57d" UNIQUE ("profId"), CONSTRAINT "PK_48eff12d6af8235a16acd3d578f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "course_section_mapping_model" ("id" SERIAL NOT NULL, "genericCourseName" character varying NOT NULL, "section" integer NOT NULL, "courseId" integer, "crn" integer, CONSTRAINT "PK_ed5d8e4898d48074841377d38d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "last_registration_model" ADD CONSTRAINT "FK_765fe567b826dd6ba406d802df6" FOREIGN KEY ("profId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prof_section_groups_model" ADD CONSTRAINT "FK_f4883601530ed63d8dcafea57d2" FOREIGN KEY ("profId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_section_mapping_model" ADD CONSTRAINT "FK_e0c220bbfe1eaf2f8488624853d" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
