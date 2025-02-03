import { MigrationInterface, QueryRunner } from 'typeorm';

export class addIntermediaryEntityForUserCourseAndAsyncQuestions1738614433982
  implements MigrationInterface
{
  name = 'addIntermediaryEntityForUserCourseAndAsyncQuestions1738614433982';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_course_async_model" ("id" SERIAL NOT NULL, "userCourseId" integer, "asyncQuestionId" integer, "readLatest" boolean NOT NULL DEFAULT false, "userId" integer, "courseId" integer, CONSTRAINT "PK_51d65ed3335832028b91d15a05e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_assignment_model" ("id" integer NOT NULL, "courseId" integer NOT NULL, "name" text NOT NULL, "description" text NOT NULL, "trackedAt" TIMESTAMP NOT NULL, "courseCourseId" integer, CONSTRAINT "PK_632eb1b1362c2e5d805db6ea013" PRIMARY KEY ("id", "courseId"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."lms_api_platform_enum" AS ENUM('Canvas')`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_course_integration_model" ("courseId" integer NOT NULL, "apiCourseId" text NOT NULL, "apiKey" text NOT NULL, "apiKeyExpiry" TIMESTAMP, "orgIntegrationOrganizationId" integer, "orgIntegrationApiPlatform" "public"."lms_api_platform_enum", CONSTRAINT "REL_594c79fce72d04560c3a4465ea" UNIQUE ("courseId"), CONSTRAINT "PK_594c79fce72d04560c3a4465ea6" PRIMARY KEY ("courseId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_org_integration_model" ("organizationId" integer NOT NULL, "apiPlatform" "public"."lms_api_platform_enum" NOT NULL, "rootUrl" text NOT NULL, CONSTRAINT "PK_8f17bd650afb1438b091dfde758" PRIMARY KEY ("organizationId", "apiPlatform"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "calendar_staff_model" ("userId" integer NOT NULL, "calendarId" integer NOT NULL, CONSTRAINT "PK_a067936add588bd9f746ac63808" PRIMARY KEY ("userId", "calendarId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP COLUMN "unreadAsyncQuestions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "courseId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "UQ_f856b9258f989bd9b71be3dd7b7" UNIQUE ("courseId")`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."event_model_eventtype_enum" RENAME TO "event_model_eventtype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_model_eventtype_enum" AS ENUM('taCheckedIn', 'taCheckedOut', 'taCheckedOutForced', 'taCheckedOutEventEnd')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ALTER COLUMN "eventType" TYPE "public"."event_model_eventtype_enum" USING "eventType"::"text"::"public"."event_model_eventtype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."event_model_eventtype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."alert_model_alerttype_enum" RENAME TO "alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum" AS ENUM('rephraseQuestion', 'eventEndedCheckoutStaff', 'promptStudentToLeaveQueue')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "alertType" TYPE "public"."alert_model_alerttype_enum" USING "alertType"::"text"::"public"."alert_model_alerttype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_async_model" ADD CONSTRAINT "FK_27f64d7080a320982d16075bc65" FOREIGN KEY ("userId") REFERENCES "user_course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_async_model" ADD CONSTRAINT "FK_9c5d9d07422ea2c4c34ad3fbe68" FOREIGN KEY ("courseId") REFERENCES "async_question_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_model" ADD CONSTRAINT "FK_5e13e46626a92677ea3528a28f5" FOREIGN KEY ("courseCourseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_2e982df9a28eed15d2c97b313d2" FOREIGN KEY ("orgIntegrationOrganizationId", "orgIntegrationApiPlatform") REFERENCES "lms_org_integration_model"("organizationId","apiPlatform") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_594c79fce72d04560c3a4465ea6" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" ADD CONSTRAINT "FK_0572ee7b5af9b49e69258079edd" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_staff_model" ADD CONSTRAINT "FK_78291b65a2dda3eebfa7feee08b" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_staff_model" ADD CONSTRAINT "FK_a8c4e36b296097a832987c9cc52" FOREIGN KEY ("calendarId") REFERENCES "calendar_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "FK_f856b9258f989bd9b71be3dd7b7" FOREIGN KEY ("courseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "FK_f856b9258f989bd9b71be3dd7b7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_staff_model" DROP CONSTRAINT "FK_a8c4e36b296097a832987c9cc52"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_staff_model" DROP CONSTRAINT "FK_78291b65a2dda3eebfa7feee08b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" DROP CONSTRAINT "FK_0572ee7b5af9b49e69258079edd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_594c79fce72d04560c3a4465ea6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_2e982df9a28eed15d2c97b313d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_model" DROP CONSTRAINT "FK_5e13e46626a92677ea3528a28f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_async_model" DROP CONSTRAINT "FK_9c5d9d07422ea2c4c34ad3fbe68"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_async_model" DROP CONSTRAINT "FK_27f64d7080a320982d16075bc65"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum_old" AS ENUM('rephraseQuestion')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "alertType" TYPE "public"."alert_model_alerttype_enum_old" USING "alertType"::"text"::"public"."alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."alert_model_alerttype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."alert_model_alerttype_enum_old" RENAME TO "alert_model_alerttype_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_model_eventtype_enum_old" AS ENUM('taCheckedIn', 'taCheckedOut', 'taCheckedOutForced')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ALTER COLUMN "eventType" TYPE "public"."event_model_eventtype_enum_old" USING "eventType"::"text"::"public"."event_model_eventtype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_model_eventtype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."event_model_eventtype_enum_old" RENAME TO "event_model_eventtype_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "UQ_f856b9258f989bd9b71be3dd7b7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "courseId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD "unreadAsyncQuestions" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`DROP TABLE "calendar_staff_model"`);
    await queryRunner.query(`DROP TABLE "lms_org_integration_model"`);
    await queryRunner.query(`DROP TYPE "public"."lms_api_platform_enum"`);
    await queryRunner.query(`DROP TABLE "lms_course_integration_model"`);
    await queryRunner.query(`DROP TYPE "public"."lms_api_platform_enum"`);
    await queryRunner.query(`DROP TABLE "lms_assignment_model"`);
    await queryRunner.query(`DROP TABLE "user_course_async_model"`);
  }
}
