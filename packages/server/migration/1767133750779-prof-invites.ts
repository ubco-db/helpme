import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfInvites1767133750779 implements MigrationInterface {
  name = 'ProfInvites1767133750779';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "prof_invite_model" ("id" SERIAL NOT NULL, "orgId" integer NOT NULL, "courseId" integer NOT NULL, "maxUses" integer NOT NULL DEFAULT '1', "usesUsed" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "code" text NOT NULL, "makeOrgProf" boolean NOT NULL DEFAULT true, "adminUserId" integer NOT NULL, CONSTRAINT "PK_1ad5cda8130f1593ecd1fb3c7b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."organization_role_history_model_rolechangereason_enum" RENAME TO "organization_role_history_model_rolechangereason_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_role_history_model_rolechangereason_enum" AS ENUM('manualModification', 'joinedOrganizationMember', 'joinedOrganizationProfessor', 'acceptedProfInvite', 'unknown')`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" ALTER COLUMN "roleChangeReason" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" ALTER COLUMN "roleChangeReason" TYPE "public"."organization_role_history_model_rolechangereason_enum" USING "roleChangeReason"::"text"::"public"."organization_role_history_model_rolechangereason_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" ALTER COLUMN "roleChangeReason" SET DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."organization_role_history_model_rolechangereason_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."mail_services_servicetype_enum" RENAME TO "mail_services_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_servicetype_enum" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post', 'course_clone_summary', 'admin_notice')`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "serviceType" TYPE "public"."mail_services_servicetype_enum" USING "serviceType"::"text"::"public"."mail_services_servicetype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."mail_services_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."sent_email_model_servicetype_enum" RENAME TO "sent_email_model_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sent_email_model_servicetype_enum" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post', 'course_clone_summary', 'admin_notice')`,
    );
    await queryRunner.query(
      `ALTER TABLE "sent_email_model" ALTER COLUMN "serviceType" TYPE "public"."sent_email_model_servicetype_enum" USING "serviceType"::"text"::"public"."sent_email_model_servicetype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."sent_email_model_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prof_invite_model" ADD CONSTRAINT "FK_067e61aaf7255af45013bcac7e1" FOREIGN KEY ("orgId") REFERENCES "organization_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prof_invite_model" ADD CONSTRAINT "FK_659d335e6d9fbbbb82ffcea77d8" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prof_invite_model" ADD CONSTRAINT "FK_ef5d23b5348776eece467ac9fca" FOREIGN KEY ("adminUserId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prof_invite_model" DROP CONSTRAINT "FK_ef5d23b5348776eece467ac9fca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prof_invite_model" DROP CONSTRAINT "FK_659d335e6d9fbbbb82ffcea77d8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prof_invite_model" DROP CONSTRAINT "FK_067e61aaf7255af45013bcac7e1"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sent_email_model_servicetype_enum_old" AS ENUM('async_question_flagged', 'async_question_human_answered', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post', 'async_question_status_changed', 'async_question_upvoted', 'course_clone_summary')`,
    );
    await queryRunner.query(
      `ALTER TABLE "sent_email_model" ALTER COLUMN "serviceType" TYPE "public"."sent_email_model_servicetype_enum_old" USING "serviceType"::"text"::"public"."sent_email_model_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."sent_email_model_servicetype_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."sent_email_model_servicetype_enum_old" RENAME TO "sent_email_model_servicetype_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_servicetype_enum_old" AS ENUM('async_question_flagged', 'async_question_human_answered', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post', 'async_question_status_changed', 'async_question_upvoted', 'course_clone_summary')`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "serviceType" TYPE "public"."mail_services_servicetype_enum_old" USING "serviceType"::"text"::"public"."mail_services_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."mail_services_servicetype_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."mail_services_servicetype_enum_old" RENAME TO "mail_services_servicetype_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_role_history_model_rolechangereason_enum_old" AS ENUM('joinedOrganizationMember', 'joinedOrganizationProfessor', 'manualModification', 'unknown')`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" ALTER COLUMN "roleChangeReason" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" ALTER COLUMN "roleChangeReason" TYPE "public"."organization_role_history_model_rolechangereason_enum_old" USING "roleChangeReason"::"text"::"public"."organization_role_history_model_rolechangereason_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" ALTER COLUMN "roleChangeReason" SET DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."organization_role_history_model_rolechangereason_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."organization_role_history_model_rolechangereason_enum_old" RENAME TO "organization_role_history_model_rolechangereason_enum"`,
    );
    await queryRunner.query(`DROP TABLE "prof_invite_model"`);
  }
}
