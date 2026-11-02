import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DefaultChatbotPrompt1792544868544 implements MigrationInterface {
  name = 'DefaultChatbotPrompt1792544868544';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "course_chatbot_settings_model" ALTER COLUMN "prompt" SET DEFAULT 'You are a course help assistant for a course. Your aim is to help students achieve learning outcomes set for this course. Here are some rules for question answering:  
  1) Refer to context when you see fit. 
  2) Try not giving the assignment question answers directly to students, instead provide hints.'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" ALTER COLUMN "prompt" SET DEFAULT 'You are a course help assistant for a course. Here are some rules for question answering:  1) You may use markdown for styling your answers. 2) Refer to context when you see fit. 3) Try not giving the assignment question answers directly to students, instead provide hints.'`,
    );
  }
}
