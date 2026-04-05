import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCourseCleanupMails1775419543155 implements MigrationInterface {
    name = 'AddCourseCleanupMails1775419543155'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."mail_services_servicetype_enum" RENAME TO "mail_services_servicetype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."mail_services_servicetype_enum" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post', 'course_clone_summary', 'weekly_course_summary', 'course_cleanup_notification', 'COURSE_CLEANUP_CONFIRMATION')`);
        await queryRunner.query(`ALTER TABLE "mail_services" ALTER COLUMN "serviceType" TYPE "public"."mail_services_servicetype_enum" USING "serviceType"::"text"::"public"."mail_services_servicetype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."mail_services_servicetype_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."sent_email_model_servicetype_enum" RENAME TO "sent_email_model_servicetype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."sent_email_model_servicetype_enum" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post', 'course_clone_summary', 'weekly_course_summary', 'course_cleanup_notification', 'COURSE_CLEANUP_CONFIRMATION')`);
        await queryRunner.query(`ALTER TABLE "sent_email_model" ALTER COLUMN "serviceType" TYPE "public"."sent_email_model_servicetype_enum" USING "serviceType"::"text"::"public"."sent_email_model_servicetype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."sent_email_model_servicetype_enum_old"`);
        await queryRunner.query(`INSERT INTO "mail_services" ("mailType", "serviceType", "name") VALUES ('professor', 'course_cleanup_notification', 'Course Cleanup Notification'), ('professor', 'COURSE_CLEANUP_CONFIRMATION', 'Course Cleanup Confirmation')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."sent_email_model_servicetype_enum_old" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post', 'course_clone_summary', 'weekly_course_summary')`);
        await queryRunner.query(`ALTER TABLE "sent_email_model" ALTER COLUMN "serviceType" TYPE "public"."sent_email_model_servicetype_enum_old" USING "serviceType"::"text"::"public"."sent_email_model_servicetype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."sent_email_model_servicetype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."sent_email_model_servicetype_enum_old" RENAME TO "sent_email_model_servicetype_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."mail_services_servicetype_enum_old" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post', 'course_clone_summary', 'weekly_course_summary')`);
        await queryRunner.query(`ALTER TABLE "mail_services" ALTER COLUMN "serviceType" TYPE "public"."mail_services_servicetype_enum_old" USING "serviceType"::"text"::"public"."mail_services_servicetype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."mail_services_servicetype_enum"`);
        await queryRunner.query(`DELETE FROM "mail_services" WHERE "serviceType" IN ('course_cleanup_notification', 'COURSE_CLEANUP_CONFIRMATION')`);
        await queryRunner.query(`ALTER TYPE "public"."mail_services_servicetype_enum_old" RENAME TO "mail_services_servicetype_enum"`);
    }

}
