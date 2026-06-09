import { MigrationInterface, QueryRunner } from 'typeorm';

export class chatbotAgentCourseGroups1780375600000
  implements MigrationInterface
{
  name = 'chatbotAgentCourseGroups1780375600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "super_course_model" ADD "purpose" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "chatbotAgentName" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "chatbotAgentDescription" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "chatbotAgentOrder" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "chatbotAgentOrder"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "chatbotAgentDescription"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "chatbotAgentName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_course_model" DROP COLUMN "purpose"`,
    );
  }
}
