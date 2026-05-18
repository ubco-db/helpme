import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddEmbeddableEntities1779062190865 implements MigrationInterface {
    name = 'AddEmbeddableEntities1779062190865'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "embeddable_question_feedback_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "submission" text NOT NULL, "aiFeedback" text NOT NULL, "aiGrade" double precision, "humanGrade" double precision, "humanFeedback" text, "questionId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_44f928f5436a18d1c85c1152ad9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "embeddable_assignment_model" ("id" SERIAL NOT NULL, "name" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "availableFrom" TIMESTAMP WITH TIME ZONE, "availableUntil" TIMESTAMP WITH TIME ZONE, "courseId" integer NOT NULL, CONSTRAINT "PK_55cb1585b595f025911a0505032" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "embeddable_assignment_feedback_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "submission" text NOT NULL, "aiFeedback" text NOT NULL, "aiGrade" double precision, "humanGrade" double precision, "humanFeedback" text, "questionId" integer NOT NULL, "userId" integer NOT NULL, "assignmentId" integer NOT NULL, CONSTRAINT "PK_d64e4c40f547e9141ee8ddd4882" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "embeddable_assignment_question_model" ("assignmentId" integer NOT NULL, "questionId" integer NOT NULL, "order" integer NOT NULL, CONSTRAINT "PK_66b5cf564a15b1f6a69e97424fc" PRIMARY KEY ("assignmentId", "questionId"))`);
        await queryRunner.query(`CREATE TABLE "embeddable_question_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "availableFrom" TIMESTAMP WITH TIME ZONE, "availableUntil" TIMESTAMP WITH TIME ZONE, "courseId" integer NOT NULL, "name" text NOT NULL, "questionText" text NOT NULL, "criteriaText" text NOT NULL, "instructions" text, "isWeak" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_7221480303ac557d4312f9f7e55" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "embeddable_question_feedback_model" ADD CONSTRAINT "FK_206d465aab2d93ecc9aac1e76da" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embeddable_question_feedback_model" ADD CONSTRAINT "FK_d052d8fe0b07aca9c6f7625ef57" FOREIGN KEY ("questionId") REFERENCES "embeddable_question_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embeddable_assignment_model" ADD CONSTRAINT "FK_e1d34dd949e81c8c0e637864325" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embeddable_assignment_feedback_model" ADD CONSTRAINT "FK_e495fb2bd7333eed5a998a8824f" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embeddable_assignment_feedback_model" ADD CONSTRAINT "FK_4c22da7f59a85883be6c291e074" FOREIGN KEY ("questionId", "assignmentId") REFERENCES "embeddable_assignment_question_model"("questionId","assignmentId") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embeddable_assignment_question_model" ADD CONSTRAINT "FK_18ec99ad357604979c24954af83" FOREIGN KEY ("assignmentId") REFERENCES "embeddable_assignment_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embeddable_assignment_question_model" ADD CONSTRAINT "FK_7385406e30714cb594273eac91e" FOREIGN KEY ("questionId") REFERENCES "embeddable_question_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embeddable_question_model" ADD CONSTRAINT "FK_79ca48befc343d6f6957ea87376" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "embeddable_question_model" DROP CONSTRAINT "FK_79ca48befc343d6f6957ea87376"`);
        await queryRunner.query(`ALTER TABLE "embeddable_assignment_question_model" DROP CONSTRAINT "FK_7385406e30714cb594273eac91e"`);
        await queryRunner.query(`ALTER TABLE "embeddable_assignment_question_model" DROP CONSTRAINT "FK_18ec99ad357604979c24954af83"`);
        await queryRunner.query(`ALTER TABLE "embeddable_assignment_feedback_model" DROP CONSTRAINT "FK_4c22da7f59a85883be6c291e074"`);
        await queryRunner.query(`ALTER TABLE "embeddable_assignment_feedback_model" DROP CONSTRAINT "FK_e495fb2bd7333eed5a998a8824f"`);
        await queryRunner.query(`ALTER TABLE "embeddable_assignment_model" DROP CONSTRAINT "FK_e1d34dd949e81c8c0e637864325"`);
        await queryRunner.query(`ALTER TABLE "embeddable_question_feedback_model" DROP CONSTRAINT "FK_d052d8fe0b07aca9c6f7625ef57"`);
        await queryRunner.query(`ALTER TABLE "embeddable_question_feedback_model" DROP CONSTRAINT "FK_206d465aab2d93ecc9aac1e76da"`);
        await queryRunner.query(`DROP TABLE "embeddable_question_model"`);
        await queryRunner.query(`DROP TABLE "embeddable_assignment_question_model"`);
        await queryRunner.query(`DROP TABLE "embeddable_assignment_feedback_model"`);
        await queryRunner.query(`DROP TABLE "embeddable_assignment_model"`);
        await queryRunner.query(`DROP TABLE "embeddable_question_feedback_model"`);
    }

}
