import { MigrationInterface, QueryRunner } from 'typeorm';

export class updateForeignKeyBehaviours1738128960964
  implements MigrationInterface
{
  name = 'updateForeignKeyBehaviours1738128960964';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP CONSTRAINT "FK_80faf01af81ddc3f4c17b6b6614"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" DROP CONSTRAINT "FK_a004c9c659f860bc2f64d107ab6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" DROP CONSTRAINT "FK_8c4bacefb7d000a0981dde66ed9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP CONSTRAINT "FK_faac87edafc4297437ed4a12d0e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP CONSTRAINT "FK_981a81bb65a54a23886eadd0b40"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP CONSTRAINT "FK_00acd7c57b3cdf6fee41e4608d7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP CONSTRAINT "FK_897f039518143a412251b010e3f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" DROP CONSTRAINT "FK_a35e40a16b61a6e191ad097ccdc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP CONSTRAINT "FK_d0a57d15e4e5c1ac71886fb4409"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP CONSTRAINT "FK_969263fc8aa84d9aafc44c6b855"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP CONSTRAINT "FK_72fbff278f28a4f6aeaa31d8fb8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP CONSTRAINT "FK_330cd37cdeeb5f54be558551fc8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_8db2901f8e702975574c1579bad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_7df3546203b677c555f27974c25"`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" DROP CONSTRAINT "FK_1e4a83bab6e8e701425f3461b04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" DROP CONSTRAINT "FK_cca54a7dc79d10d04ba12fe7af4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" DROP CONSTRAINT "FK_4b2c20ac04a24393fff2d974024"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" DROP CONSTRAINT "FK_25c224ece4509a7a4582357605f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" DROP CONSTRAINT "FK_b47c12b782d3e463acdf841bbf7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" DROP CONSTRAINT "FK_a66ca3a1a5f8947ffeff3ff7f54"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_594c79fce72d04560c3a4465ea6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" DROP CONSTRAINT "FK_b8c814dda28118c8a141863afff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" DROP CONSTRAINT "FK_71566c4e2836bea0d62bb7b4db2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "FK_34820ed355fa20cb6037e9cab78"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_section_mapping_model" DROP CONSTRAINT "FK_e0c220bbfe1eaf2f8488624853d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "last_registration_model" DROP CONSTRAINT "FK_765fe567b826dd6ba406d802df6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prof_section_groups_model" DROP CONSTRAINT "FK_f4883601530ed63d8dcafea57d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD CONSTRAINT "FK_80faf01af81ddc3f4c17b6b6614" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" ADD CONSTRAINT "FK_8c4bacefb7d000a0981dde66ed9" FOREIGN KEY ("creatorId") REFERENCES "user_course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" ADD CONSTRAINT "FK_a004c9c659f860bc2f64d107ab6" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_faac87edafc4297437ed4a12d0e" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_00acd7c57b3cdf6fee41e4608d7" FOREIGN KEY ("creatorId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_981a81bb65a54a23886eadd0b40" FOREIGN KEY ("taHelpedId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD CONSTRAINT "FK_897f039518143a412251b010e3f" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ADD CONSTRAINT "FK_a35e40a16b61a6e191ad097ccdc" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_d0a57d15e4e5c1ac71886fb4409" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_969263fc8aa84d9aafc44c6b855" FOREIGN KEY ("creatorId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_330cd37cdeeb5f54be558551fc8" FOREIGN KEY ("taHelpedId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_72fbff278f28a4f6aeaa31d8fb8" FOREIGN KEY ("groupId") REFERENCES "question_group_model"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7" FOREIGN KEY ("interaction") REFERENCES "chatbot_interactions_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_7df3546203b677c555f27974c25" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_8db2901f8e702975574c1579bad" FOREIGN KEY ("user") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ADD CONSTRAINT "FK_1e4a83bab6e8e701425f3461b04" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ADD CONSTRAINT "FK_cca54a7dc79d10d04ba12fe7af4" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ADD CONSTRAINT "FK_4b2c20ac04a24393fff2d974024" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" ADD CONSTRAINT "FK_25c224ece4509a7a4582357605f" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" ADD CONSTRAINT "FK_b47c12b782d3e463acdf841bbf7" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" ADD CONSTRAINT "FK_a66ca3a1a5f8947ffeff3ff7f54" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_594c79fce72d04560c3a4465ea6" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ADD CONSTRAINT "FK_b8c814dda28118c8a141863afff" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ADD CONSTRAINT "FK_71566c4e2836bea0d62bb7b4db2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "FK_34820ed355fa20cb6037e9cab78" FOREIGN KEY ("semesterId") REFERENCES "semester_model"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_section_mapping_model" ADD CONSTRAINT "FK_e0c220bbfe1eaf2f8488624853d" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "last_registration_model" ADD CONSTRAINT "FK_765fe567b826dd6ba406d802df6" FOREIGN KEY ("profId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prof_section_groups_model" ADD CONSTRAINT "FK_f4883601530ed63d8dcafea57d2" FOREIGN KEY ("profId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prof_section_groups_model" DROP CONSTRAINT "FK_f4883601530ed63d8dcafea57d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "last_registration_model" DROP CONSTRAINT "FK_765fe567b826dd6ba406d802df6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_section_mapping_model" DROP CONSTRAINT "FK_e0c220bbfe1eaf2f8488624853d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "FK_34820ed355fa20cb6037e9cab78"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" DROP CONSTRAINT "FK_71566c4e2836bea0d62bb7b4db2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" DROP CONSTRAINT "FK_b8c814dda28118c8a141863afff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_model" DROP CONSTRAINT "FK_032500ffb7d3abb9cc5769e422a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_594c79fce72d04560c3a4465ea6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" DROP CONSTRAINT "FK_a66ca3a1a5f8947ffeff3ff7f54"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" DROP CONSTRAINT "FK_b47c12b782d3e463acdf841bbf7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" DROP CONSTRAINT "FK_25c224ece4509a7a4582357605f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" DROP CONSTRAINT "FK_4b2c20ac04a24393fff2d974024"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" DROP CONSTRAINT "FK_cca54a7dc79d10d04ba12fe7af4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" DROP CONSTRAINT "FK_1e4a83bab6e8e701425f3461b04"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_8db2901f8e702975574c1579bad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_7df3546203b677c555f27974c25"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP CONSTRAINT "FK_72fbff278f28a4f6aeaa31d8fb8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP CONSTRAINT "FK_330cd37cdeeb5f54be558551fc8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP CONSTRAINT "FK_969263fc8aa84d9aafc44c6b855"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP CONSTRAINT "FK_d0a57d15e4e5c1ac71886fb4409"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" DROP CONSTRAINT "FK_a35e40a16b61a6e191ad097ccdc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP CONSTRAINT "FK_897f039518143a412251b010e3f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP CONSTRAINT "FK_981a81bb65a54a23886eadd0b40"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP CONSTRAINT "FK_00acd7c57b3cdf6fee41e4608d7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP CONSTRAINT "FK_faac87edafc4297437ed4a12d0e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" DROP CONSTRAINT "FK_a004c9c659f860bc2f64d107ab6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" DROP CONSTRAINT "FK_8c4bacefb7d000a0981dde66ed9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP CONSTRAINT "FK_80faf01af81ddc3f4c17b6b6614"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prof_section_groups_model" ADD CONSTRAINT "FK_f4883601530ed63d8dcafea57d2" FOREIGN KEY ("profId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "last_registration_model" ADD CONSTRAINT "FK_765fe567b826dd6ba406d802df6" FOREIGN KEY ("profId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_section_mapping_model" ADD CONSTRAINT "FK_e0c220bbfe1eaf2f8488624853d" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "FK_34820ed355fa20cb6037e9cab78" FOREIGN KEY ("semesterId") REFERENCES "semester_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ADD CONSTRAINT "FK_71566c4e2836bea0d62bb7b4db2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ADD CONSTRAINT "FK_b8c814dda28118c8a141863afff" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_594c79fce72d04560c3a4465ea6" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" ADD CONSTRAINT "FK_a66ca3a1a5f8947ffeff3ff7f54" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" ADD CONSTRAINT "FK_b47c12b782d3e463acdf841bbf7" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" ADD CONSTRAINT "FK_25c224ece4509a7a4582357605f" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ADD CONSTRAINT "FK_4b2c20ac04a24393fff2d974024" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ADD CONSTRAINT "FK_cca54a7dc79d10d04ba12fe7af4" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ADD CONSTRAINT "FK_1e4a83bab6e8e701425f3461b04" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_7df3546203b677c555f27974c25" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_8db2901f8e702975574c1579bad" FOREIGN KEY ("user") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7" FOREIGN KEY ("interaction") REFERENCES "chatbot_interactions_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_330cd37cdeeb5f54be558551fc8" FOREIGN KEY ("taHelpedId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_72fbff278f28a4f6aeaa31d8fb8" FOREIGN KEY ("groupId") REFERENCES "question_group_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_969263fc8aa84d9aafc44c6b855" FOREIGN KEY ("creatorId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_d0a57d15e4e5c1ac71886fb4409" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ADD CONSTRAINT "FK_a35e40a16b61a6e191ad097ccdc" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD CONSTRAINT "FK_897f039518143a412251b010e3f" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_00acd7c57b3cdf6fee41e4608d7" FOREIGN KEY ("creatorId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_981a81bb65a54a23886eadd0b40" FOREIGN KEY ("taHelpedId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_faac87edafc4297437ed4a12d0e" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" ADD CONSTRAINT "FK_8c4bacefb7d000a0981dde66ed9" FOREIGN KEY ("creatorId") REFERENCES "user_course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" ADD CONSTRAINT "FK_a004c9c659f860bc2f64d107ab6" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD CONSTRAINT "FK_80faf01af81ddc3f4c17b6b6614" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
