import { MigrationInterface, QueryRunner } from 'typeorm';

export class addFlagsToQuestionTypes1709398996584
  implements MigrationInterface
{
  name = 'addFlagsToQuestionTypes1709398996584';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD "forAsync" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD "forQueue" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP COLUMN "forQueue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP COLUMN "forAsync"`,
    );
  }
}
