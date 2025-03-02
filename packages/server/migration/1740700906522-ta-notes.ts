import { MigrationInterface, QueryRunner } from 'typeorm';

export class taNotes1740700906522 implements MigrationInterface {
  name = 'taNotes1740700906522';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD "TANotes" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP COLUMN "TANotes"`,
    );
  }
}
