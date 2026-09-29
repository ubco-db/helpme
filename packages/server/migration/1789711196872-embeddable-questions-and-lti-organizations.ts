import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmbeddableQuestionsAndLtiOrganizations1789711196872 implements MigrationInterface {
  name = 'EmbeddableQuestionsAndLtiOrganizations1789711196872';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "embeddable_question_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "courseId" integer NOT NULL, "title" text NOT NULL, "questionText" text NOT NULL, "gradingSettings" jsonb NOT NULL, CONSTRAINT "PK_7221480303ac557d4312f9f7e55" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "embeddable_question_feedback_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "courseId" integer NOT NULL, "questionId" integer NOT NULL, "userId" integer NOT NULL, "submission" text NOT NULL, "aiFeedback" text NOT NULL, "aiGrade" double precision NOT NULL, "appliedRequirements" text array NOT NULL DEFAULT '{}', "aiModel" text, "maxScore" double precision NOT NULL, "gradingSnapshot" jsonb NOT NULL, "reasons" text array NOT NULL DEFAULT '{}', "humanReviewReason" text, CONSTRAINT "PK_44f928f5436a18d1c85c1152ad9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" ADD "ltiPlatformId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" ADD CONSTRAINT "UQ_bb3df6b55028b05540a07854950" UNIQUE ("ltiPlatformId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "lti_identity_token_model" ADD "organizationId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "UQ_3d4257edc278b52408cab4cecad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "UQ_aaa95fd2f694ba87f12e8cc95fa" UNIQUE ("orgIntegrationOrganizationId", "orgIntegrationApiPlatform", "apiCourseId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD CONSTRAINT "FK_79ca48befc343d6f6957ea87376" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD CONSTRAINT "FK_21ce283653acf7fe839e4b5a298" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD CONSTRAINT "FK_d052d8fe0b07aca9c6f7625ef57" FOREIGN KEY ("questionId") REFERENCES "embeddable_question_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD CONSTRAINT "FK_206d465aab2d93ecc9aac1e76da" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP CONSTRAINT "FK_206d465aab2d93ecc9aac1e76da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP CONSTRAINT "FK_d052d8fe0b07aca9c6f7625ef57"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP CONSTRAINT "FK_21ce283653acf7fe839e4b5a298"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP CONSTRAINT "FK_79ca48befc343d6f6957ea87376"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "UQ_aaa95fd2f694ba87f12e8cc95fa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "UQ_3d4257edc278b52408cab4cecad" UNIQUE ("apiCourseId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "lti_identity_token_model" DROP COLUMN "organizationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" DROP CONSTRAINT "UQ_bb3df6b55028b05540a07854950"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" DROP COLUMN "ltiPlatformId"`,
    );
    await queryRunner.query(`DROP TABLE "embeddable_question_feedback_model"`);
    await queryRunner.query(`DROP TABLE "embeddable_question_model"`);
  }
}
