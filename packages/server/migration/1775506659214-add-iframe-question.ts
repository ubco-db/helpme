import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIFrameQuestion1775506659214 implements MigrationInterface {
  name = 'AddIFrameQuestion1775506659214';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "iframe_question_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(), "courseId" integer NOT NULL, "questionText" text NOT NULL, "criteriaText" text NOT NULL, "instructions" text, CONSTRAINT "PK_23f0c2230e948d3b6bc0cd86f74" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "iframe_question_model" ADD CONSTRAINT "FK_47a01b6d08a71eb9ab021fc1cf3" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "iframe_question_model" DROP CONSTRAINT "FK_47a01b6d08a71eb9ab021fc1cf3"`,
    );
    await queryRunner.query(`DROP TABLE "iframe_question_model"`);
  }
}
