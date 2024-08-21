import { MigrationInterface, QueryRunner } from 'typeorm';

export class mailService1724271838364 implements MigrationInterface {
  name = 'mailService1724271838364';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_servicetype_enum" AS ENUM('async_question_human_answered', 'async_question_flagged')`,
    );
    await queryRunner.query(
      `CREATE TABLE "mail_services" ("id" SERIAL NOT NULL, "mailType" character varying NOT NULL, "serviceType" "public"."mail_services_servicetype_enum" NOT NULL, "name" character varying NOT NULL, "content" character varying NOT NULL, CONSTRAINT "UQ_d9bef3dd760d8d00931e83c0bc5" UNIQUE ("serviceType"), CONSTRAINT "PK_1ef95f3fe9df7f9707e5ed8e16e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_subscriptions" ("id" SERIAL NOT NULL, "serviceId" integer NOT NULL, "userId" integer NOT NULL, "isSubscribed" boolean NOT NULL, CONSTRAINT "PK_9e928b0954e51705ab44988812c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" ADD CONSTRAINT "FK_2dfab576863bc3f84d4f6962274" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" ADD CONSTRAINT "FK_2fd3843d21325cb115b90686562" FOREIGN KEY ("serviceId") REFERENCES "mail_services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP CONSTRAINT "FK_2fd3843d21325cb115b90686562"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP CONSTRAINT "FK_2dfab576863bc3f84d4f6962274"`,
    );
    await queryRunner.query(`DROP TABLE "user_subscriptions"`);
    await queryRunner.query(`DROP TABLE "mail_services"`);
    await queryRunner.query(
      `DROP TYPE "public"."mail_services_servicetype_enum"`,
    );
  }
}
