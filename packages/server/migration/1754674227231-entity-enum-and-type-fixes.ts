import { MigrationInterface, QueryRunner } from 'typeorm';

export class EntityEnumAndTypeFixes1754674227231 implements MigrationInterface {
  name = 'EntityEnumAndTypeFixes1754674227231';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."question_model_location_enum" AS ENUM('Online', 'In-Person', 'Unselected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ALTER COLUMN "location" SET DEFAULT 'Unselected'::"public"."question_model_location_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ALTER COLUMN "location" SET NOT NULL`,
    );
    await queryRunner.query(`
            ALTER TABLE "question_model" 
            ALTER COLUMN "location" 
            TYPE "public"."question_model_location_enum" USING 
            (CASE 
                WHEN "location" = 'In Person' THEN 'In-Person'::"public"."question_model_location_enum" 
                WHEN "location" = 'Online' THEN 'Online'::"public"."question_model_location_enum"
                ELSE 'Unselected'::"public"."question_model_location_enum"
            END)
        `);

    await queryRunner.query(
      `CREATE TYPE "public"."queue_model_type_enum" AS ENUM('online', 'hybrid', 'inPerson')`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ALTER COLUMN "type" SET DEFAULT 'hybrid'::"public"."queue_model_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ALTER COLUMN "type" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ALTER COLUMN "type" TYPE "public"."queue_model_type_enum" USING ("type"::"public"."queue_model_type_enum")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_mailtype_enum" AS ENUM('member', 'admin', 'professor')`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "mailType" SET DEFAULT 'member'::"public"."mail_services_mailtype_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "mailType" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "mailType" TYPE "public"."mail_services_mailtype_enum" USING ("mailType"::"public"."mail_services_mailtype_enum")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "mailType" TYPE CHARACTER VARYING`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "mailType" SET DEFAULT 'member'::CHARACTER VARYING`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ALTER COLUMN "type" TYPE CHARACTER VARYING`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ALTER COLUMN "type" SET DEFAULT 'hybrid'::CHARACTER VARYING`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ALTER COLUMN "location" TYPE CHARACTER VARYING`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ALTER COLUMN "location" SET DEFAULT 'Unselected'::CHARACTER VARYING`,
    );
    await queryRunner.query(`DROP TYPE "public"."mail_services_mailtype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."queue_model_type_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."question_model_location_enum"`,
    );
  }
}
