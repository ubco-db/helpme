import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseDeleteCascade1772417148944 implements MigrationInterface {
  name = 'AddCourseDeleteCascade1772417148944';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP CONSTRAINT "FK_3f38d8a85115b61789f02fc5c3b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP CONSTRAINT "FK_faac87edafc4297437ed4a12d0e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" DROP CONSTRAINT "FK_a35e40a16b61a6e191ad097ccdc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" DROP CONSTRAINT "FK_4b2c20ac04a24393fff2d974024"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" DROP CONSTRAINT "FK_4fef22be04e7b58e8728a24b207"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_594c79fce72d04560c3a4465ea6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" DROP CONSTRAINT "FK_47403ceb85db02238d9c63bd73f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_7df3546203b677c555f27974c25"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" DROP CONSTRAINT "FK_b47c12b782d3e463acdf841bbf7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" DROP CONSTRAINT "FK_71566c4e2836bea0d62bb7b4db2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD CONSTRAINT "FK_3f38d8a85115b61789f02fc5c3b" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_faac87edafc4297437ed4a12d0e" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ADD CONSTRAINT "FK_a35e40a16b61a6e191ad097ccdc" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ADD CONSTRAINT "FK_4b2c20ac04a24393fff2d974024" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" ADD CONSTRAINT "FK_4fef22be04e7b58e8728a24b207" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_594c79fce72d04560c3a4465ea6" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" ADD CONSTRAINT "FK_47403ceb85db02238d9c63bd73f" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_7df3546203b677c555f27974c25" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" ADD CONSTRAINT "FK_b47c12b782d3e463acdf841bbf7" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ADD CONSTRAINT "FK_71566c4e2836bea0d62bb7b4db2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alert_model" DROP CONSTRAINT "FK_71566c4e2836bea0d62bb7b4db2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" DROP CONSTRAINT "FK_b47c12b782d3e463acdf841bbf7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_7df3546203b677c555f27974c25"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" DROP CONSTRAINT "FK_47403ceb85db02238d9c63bd73f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_594c79fce72d04560c3a4465ea6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" DROP CONSTRAINT "FK_4fef22be04e7b58e8728a24b207"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" DROP CONSTRAINT "FK_4b2c20ac04a24393fff2d974024"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" DROP CONSTRAINT "FK_a35e40a16b61a6e191ad097ccdc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP CONSTRAINT "FK_faac87edafc4297437ed4a12d0e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP CONSTRAINT "FK_3f38d8a85115b61789f02fc5c3b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ADD CONSTRAINT "FK_71566c4e2836bea0d62bb7b4db2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" ADD CONSTRAINT "FK_b47c12b782d3e463acdf841bbf7" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_7df3546203b677c555f27974c25" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_chatbot_settings_model" ADD CONSTRAINT "FK_47403ceb85db02238d9c63bd73f" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_594c79fce72d04560c3a4465ea6" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" ADD CONSTRAINT "FK_4fef22be04e7b58e8728a24b207" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ADD CONSTRAINT "FK_4b2c20ac04a24393fff2d974024" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ADD CONSTRAINT "FK_a35e40a16b61a6e191ad097ccdc" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_faac87edafc4297437ed4a12d0e" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD CONSTRAINT "FK_3f38d8a85115b61789f02fc5c3b" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
