import { MigrationInterface, QueryRunner } from 'typeorm';

export class addInsightDashboardModel1728256656281
  implements MigrationInterface
{
  name = 'addInsightDashboardModel1728256656281';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "admin_user_model" ("id" SERIAL NOT NULL, "username" character varying(128) NOT NULL, "passwordHash" character varying(128) NOT NULL, CONSTRAINT "UQ_3bd93958ed6371e903adcf949ed" UNIQUE ("username"), CONSTRAINT "PK_8a1fc018fffae50239eeb881673" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "insight_dashboard_model" ("userCourseId" integer NOT NULL, "name" text NOT NULL, "insights" text NOT NULL DEFAULT '{}', CONSTRAINT "dashboardKey" UNIQUE ("name", "userCourseId"), CONSTRAINT "PK_bb78ab39d32c6d294d6ab0b3d6c" PRIMARY KEY ("userCourseId", "name"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_course_model_role_enum" AS ENUM('student', 'ta', 'professor')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_course_model" ("id" SERIAL NOT NULL, "userId" integer, "courseId" integer, "role" "public"."user_course_model_role_enum" NOT NULL DEFAULT 'student', "expires" boolean DEFAULT false, CONSTRAINT "PK_2cbd278a1b02be0836e035932d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "question_group_model" ("id" SERIAL NOT NULL, "creatorId" integer NOT NULL, "queueId" integer, CONSTRAINT "PK_8fd732a9db416edb70c7fdc8a3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "async_question_votes_model" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "questionId" integer NOT NULL, "vote" integer NOT NULL, CONSTRAINT "PK_1325449725853fd33254b3ecb9f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "async_question_model" ("id" SERIAL NOT NULL, "courseId" integer, "questionAbstract" text NOT NULL, "questionText" text, "aiAnswerText" text, "answerText" text, "creatorId" integer, "taHelpedId" integer, "createdAt" TIMESTAMP NOT NULL, "closedAt" TIMESTAMP, "status" text NOT NULL, "visible" boolean, "verified" boolean NOT NULL, CONSTRAINT "PK_fa05a9dd394b46bde1b0d2c8e73" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "question_type_model" ("id" SERIAL NOT NULL, "cid" integer, "name" text, "color" text DEFAULT '#000000', "queueId" integer, "deletedAt" TIMESTAMP, CONSTRAINT "PK_87be2766a950ff35d2bb47ab735" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "queue_invite_model" ("queueId" integer NOT NULL, "QRCodeEnabled" boolean NOT NULL DEFAULT true, "isQuestionsVisible" boolean NOT NULL DEFAULT false, "willInviteToCourse" boolean NOT NULL DEFAULT false, "inviteCode" text NOT NULL DEFAULT '', "QRCodeErrorLevel" character varying(1) NOT NULL DEFAULT 'L', CONSTRAINT "REL_4666f20b8ec1107f9973e96606" UNIQUE ("queueId"), CONSTRAINT "PK_4666f20b8ec1107f9973e966062" PRIMARY KEY ("queueId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "queue_model" ("id" SERIAL NOT NULL, "courseId" integer, "room" text NOT NULL, "notes" text, "allowQuestions" boolean NOT NULL DEFAULT false, "isProfessorQueue" boolean NOT NULL DEFAULT false, "isDisabled" boolean NOT NULL DEFAULT false, "config" json, CONSTRAINT "PK_5b66cb7b2bb41ac4c8657e02849" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "question_model" ("id" SERIAL NOT NULL, "queueId" integer, "text" text NOT NULL, "creatorId" integer, "taHelpedId" integer, "createdAt" TIMESTAMP NOT NULL, "firstHelpedAt" TIMESTAMP, "helpedAt" TIMESTAMP, "closedAt" TIMESTAMP, "status" text NOT NULL, "location" character varying, "groupable" boolean NOT NULL, "isTaskQuestion" boolean NOT NULL DEFAULT false, "groupId" integer, CONSTRAINT "PK_c500e98286cf533b93c8ca91ac9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chatbot_questions_model" ("id" SERIAL NOT NULL, "vectorStoreId" character varying, "interactionId" integer, "questionText" character varying NOT NULL, "responseText" character varying NOT NULL, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "userScore" integer NOT NULL DEFAULT '0', "isPreviousQuestion" boolean NOT NULL DEFAULT false, "suggested" boolean NOT NULL DEFAULT false, "interaction" integer, CONSTRAINT "PK_2c16440cca88ebd9a6211cab9b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chatbot_interactions_model" ("id" SERIAL NOT NULL, "timestamp" TIMESTAMP NOT NULL, "course" integer, "user" integer, CONSTRAINT "PK_dfa22bd83de6c88afe6caa5ae37" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "desktop_notif_model" ("id" SERIAL NOT NULL, "endpoint" text NOT NULL, "expirationTime" TIMESTAMP, "p256dh" text NOT NULL, "auth" text NOT NULL, "userId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "name" text, CONSTRAINT "PK_d3052edaec243f21b0f2412cf34" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_model_eventtype_enum" AS ENUM('taCheckedIn', 'taCheckedOut', 'taCheckedOutForced')`,
    );
    await queryRunner.query(
      `CREATE TABLE "event_model" ("id" SERIAL NOT NULL, "time" TIMESTAMP NOT NULL, "eventType" "public"."event_model_eventtype_enum" NOT NULL, "userId" integer, "courseId" integer, "queueId" integer, CONSTRAINT "PK_d3e2fa2b042c7b712aa4455fefc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_course_model" ("id" SERIAL NOT NULL, "organizationId" integer, "courseId" integer, CONSTRAINT "REL_4fef22be04e7b58e8728a24b20" UNIQUE ("courseId"), CONSTRAINT "PK_0c104671bce991fdbf1c3d317e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_model" ("id" SERIAL NOT NULL, "name" text NOT NULL, "description" text, "logoUrl" text, "bannerUrl" text, "websiteUrl" text, "ssoEnabled" boolean NOT NULL DEFAULT false, "legacyAuthEnabled" boolean NOT NULL DEFAULT false, "googleAuthEnabled" boolean NOT NULL DEFAULT true, "ssoUrl" text, CONSTRAINT "PK_58d7955a28fb825ca3ad5b18862" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_user_model_role_enum" AS ENUM('member', 'admin', 'professor')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_user_model" ("id" SERIAL NOT NULL, "userId" integer, "organizationId" integer, "role" "public"."organization_user_model_role_enum" NOT NULL DEFAULT 'member', CONSTRAINT "REL_d76bf27825067e1e6f83d7913f" UNIQUE ("userId"), CONSTRAINT "PK_5611727c18cc918add73c20efc6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_token_model" ("id" SERIAL NOT NULL, "token" text NOT NULL, "created_at" bigint NOT NULL, "expires_at" bigint NOT NULL, "token_type" text NOT NULL DEFAULT 'EMAIL_VERIFICATION', "token_action" text NOT NULL DEFAULT 'ACTION_PENDING', "userId" integer, CONSTRAINT "PK_1698265c5483235eabd11cf56f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_token_model" ("id" SERIAL NOT NULL, "token" text NOT NULL, "used" integer NOT NULL DEFAULT '0', "max_uses" integer NOT NULL DEFAULT '30', "user" integer, CONSTRAINT "UQ_71024eeefbc25279dd420815cf9" UNIQUE ("token"), CONSTRAINT "REL_06d13508f10e479d1f99c2fb30" UNIQUE ("user"), CONSTRAINT "PK_8884fc34ef0c37cee8b84af5b16" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "student_task_progress_model" ("taskProgress" json, "uid" integer NOT NULL, "cid" integer NOT NULL, CONSTRAINT "PK_4dd97a62b3d704dcd4cba229735" PRIMARY KEY ("uid", "cid"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_servicetype_enum" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "mail_services" ("id" SERIAL NOT NULL, "mailType" character varying NOT NULL, "serviceType" "public"."mail_services_servicetype_enum" NOT NULL, "name" character varying NOT NULL, "content" character varying NOT NULL, CONSTRAINT "UQ_d9bef3dd760d8d00931e83c0bc5" UNIQUE ("serviceType"), CONSTRAINT "PK_1ef95f3fe9df7f9707e5ed8e16e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_subscriptions" ("serviceId" integer NOT NULL, "userId" integer NOT NULL, "isSubscribed" boolean NOT NULL, CONSTRAINT "PK_7ff78f847bc9e3e7994e677dd9f" PRIMARY KEY ("serviceId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_model_userrole_enum" AS ENUM('user', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_model" ("id" SERIAL NOT NULL, "sid" integer, "email" text NOT NULL, "password" text, "firstName" text, "lastName" text, "photoURL" text, "emailVerified" boolean NOT NULL DEFAULT false, "defaultMessage" text, "includeDefaultMessage" boolean NOT NULL DEFAULT true, "accountType" text NOT NULL DEFAULT 'legacy', "accountDeactivated" boolean NOT NULL DEFAULT false, "desktopNotifsEnabled" boolean NOT NULL DEFAULT false, "userRole" "public"."user_model_userrole_enum" NOT NULL DEFAULT 'user', "hideInsights" text, CONSTRAINT "PK_7d6bfa71f4d6a1fa0af1f688327" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum" AS ENUM('rephraseQuestion')`,
    );
    await queryRunner.query(
      `CREATE TABLE "alert_model" ("id" SERIAL NOT NULL, "alertType" "public"."alert_model_alerttype_enum" NOT NULL, "sent" TIMESTAMP NOT NULL, "resolved" TIMESTAMP, "userId" integer, "courseId" integer, "payload" json NOT NULL, CONSTRAINT "PK_5dc11158250a348d41af881f2cf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "semester_model" ("id" SERIAL NOT NULL, "season" text NOT NULL, "year" integer NOT NULL, CONSTRAINT "PK_1a6198e89d15dc319132ce57b1c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "course_settings_model" ("courseId" integer NOT NULL, "chatBotEnabled" boolean NOT NULL DEFAULT true, "asyncQueueEnabled" boolean NOT NULL DEFAULT true, "adsEnabled" boolean NOT NULL DEFAULT true, "queueEnabled" boolean NOT NULL DEFAULT true, "scheduleOnFrontPage" boolean NOT NULL DEFAULT false, "asyncCentreAIAnswers" boolean NOT NULL DEFAULT true, CONSTRAINT "REL_0b8c46d3c880227af25ce517ee" UNIQUE ("courseId"), CONSTRAINT "PK_0b8c46d3c880227af25ce517ee2" PRIMARY KEY ("courseId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "course_model" ("id" SERIAL NOT NULL, "name" text NOT NULL, "sectionGroupName" text NOT NULL, "coordinator_email" text, "icalURL" text, "zoomLink" text, "questionTimer" integer, "semesterId" integer, "enabled" boolean, "timezone" text, "selfEnroll" boolean DEFAULT false, "asyncQuestionDisplayTypes" text array DEFAULT '{}', "deletedAt" TIMESTAMP, "courseInviteCode" text, CONSTRAINT "PK_78f12196238e8ce83a249b05af2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "course_section_mapping_model" ("id" SERIAL NOT NULL, "crn" integer, "courseId" integer, CONSTRAINT "PK_ed5d8e4898d48074841377d38d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "last_registration_model" ("id" SERIAL NOT NULL, "profId" integer NOT NULL, "lastRegisteredSemester" text NOT NULL, CONSTRAINT "REL_765fe567b826dd6ba406d802df" UNIQUE ("profId"), CONSTRAINT "PK_6d0443f00d236b837aaf4a49726" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "prof_section_groups_model" ("id" SERIAL NOT NULL, "profId" integer NOT NULL, "sectionGroups" jsonb, CONSTRAINT "REL_f4883601530ed63d8dcafea57d" UNIQUE ("profId"), CONSTRAINT "PK_48eff12d6af8235a16acd3d578f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "question_document_model" ("id" SERIAL NOT NULL, "questionId" integer NOT NULL, "name" character varying NOT NULL, "type" character varying NOT NULL, "parts" text array NOT NULL, CONSTRAINT "PK_c8480de4d48b8bd2f557a533346" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."calendar_model_locationtype_enum" AS ENUM('in-person', 'online', 'hybrid')`,
    );
    await queryRunner.query(
      `CREATE TABLE "calendar_model" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "start" TIMESTAMP NOT NULL, "end" TIMESTAMP NOT NULL, "startDate" date, "endDate" date, "daysOfWeek" text array, "allDay" boolean, "locationType" "public"."calendar_model_locationtype_enum" NOT NULL, "locationOnline" character varying, "locationInPerson" character varying, "color" character varying(7) DEFAULT '#3788d8', "course" integer, CONSTRAINT "PK_169e34dda38ee87191b602f2a76" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "config_model" ("id" SERIAL NOT NULL, "max_async_questions" bigint NOT NULL DEFAULT '100', "max_queues_per_course" bigint NOT NULL DEFAULT '30', "max_question_types_per_queue" bigint NOT NULL DEFAULT '20', "max_questions_per_queue" bigint NOT NULL DEFAULT '30', "max_semesters" bigint NOT NULL DEFAULT '40', CONSTRAINT "PK_bdb17f3848b5e161e7867afec72" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "async_question_question_type_model" ("questionId" integer NOT NULL, "questionTypeId" integer NOT NULL, CONSTRAINT "PK_ed41fa9ef3d56ac433219096cf3" PRIMARY KEY ("questionId", "questionTypeId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f2bd3a8b19d3f7d47f11c74644" ON "async_question_question_type_model" ("questionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50664d2df3841be1660871f04d" ON "async_question_question_type_model" ("questionTypeId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "queue_model_staff_list_user_model" ("queueModelId" integer NOT NULL, "userModelId" integer NOT NULL, CONSTRAINT "PK_6b3aa53a9f57b461eb8aa68cfd3" PRIMARY KEY ("queueModelId", "userModelId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2fd33d9360492e0ae1cc3332bd" ON "queue_model_staff_list_user_model" ("queueModelId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_afc7595c6141d48fc334da2240" ON "queue_model_staff_list_user_model" ("userModelId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "question_question_type_model" ("questionId" integer NOT NULL, "questionTypeId" integer NOT NULL, CONSTRAINT "PK_d095cf5e00b81b0ba01613c4cc1" PRIMARY KEY ("questionId", "questionTypeId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bc6bfc7f61c7bc23e010017959" ON "question_question_type_model" ("questionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3c8ba3b5a5d91391e20045e72a" ON "question_question_type_model" ("questionTypeId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "insight_dashboard_model" ADD CONSTRAINT "FK_c5973ea9aade467a0d46aad78f5" FOREIGN KEY ("userCourseId") REFERENCES "user_course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD CONSTRAINT "FK_80faf01af81ddc3f4c17b6b6614" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD CONSTRAINT "FK_3f38d8a85115b61789f02fc5c3b" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" ADD CONSTRAINT "FK_8c4bacefb7d000a0981dde66ed9" FOREIGN KEY ("creatorId") REFERENCES "user_course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" ADD CONSTRAINT "FK_a004c9c659f860bc2f64d107ab6" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" ADD CONSTRAINT "FK_001cf9c56d1fa2cb4d0963aecbb" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" ADD CONSTRAINT "FK_eb178f187843117070809c574ed" FOREIGN KEY ("questionId") REFERENCES "async_question_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_faac87edafc4297437ed4a12d0e" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_00acd7c57b3cdf6fee41e4608d7" FOREIGN KEY ("creatorId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD CONSTRAINT "FK_981a81bb65a54a23886eadd0b40" FOREIGN KEY ("taHelpedId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD CONSTRAINT "FK_a3ecde22b20f0416affdad4d0d3" FOREIGN KEY ("cid") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD CONSTRAINT "FK_897f039518143a412251b010e3f" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD CONSTRAINT "FK_4666f20b8ec1107f9973e966062" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model" ADD CONSTRAINT "FK_a35e40a16b61a6e191ad097ccdc" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_d0a57d15e4e5c1ac71886fb4409" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_969263fc8aa84d9aafc44c6b855" FOREIGN KEY ("creatorId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_330cd37cdeeb5f54be558551fc8" FOREIGN KEY ("taHelpedId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD CONSTRAINT "FK_72fbff278f28a4f6aeaa31d8fb8" FOREIGN KEY ("groupId") REFERENCES "question_group_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD CONSTRAINT "FK_cbae79b5aab51ebd086473b1aa7" FOREIGN KEY ("interaction") REFERENCES "chatbot_interactions_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_7df3546203b677c555f27974c25" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_8db2901f8e702975574c1579bad" FOREIGN KEY ("user") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "desktop_notif_model" ADD CONSTRAINT "FK_1e4a83bab6e8e701425f3461b04" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ADD CONSTRAINT "FK_cca54a7dc79d10d04ba12fe7af4" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ADD CONSTRAINT "FK_4b2c20ac04a24393fff2d974024" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ADD CONSTRAINT "FK_bfbc6e5ef5e94a2545ef2d625ac" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" ADD CONSTRAINT "FK_a66ca3a1a5f8947ffeff3ff7f54" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" ADD CONSTRAINT "FK_4fef22be04e7b58e8728a24b207" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" ADD CONSTRAINT "FK_5d6af5a8f147be0ffb523ae9f58" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" ADD CONSTRAINT "FK_d76bf27825067e1e6f83d7913fc" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" ADD CONSTRAINT "FK_25c224ece4509a7a4582357605f" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_token_model" ADD CONSTRAINT "FK_06d13508f10e479d1f99c2fb306" FOREIGN KEY ("user") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" ADD CONSTRAINT "FK_e855cab9855b51519940f751262" FOREIGN KEY ("uid") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" ADD CONSTRAINT "FK_00d27c247661185ee5c46b03412" FOREIGN KEY ("cid") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" ADD CONSTRAINT "FK_2dfab576863bc3f84d4f6962274" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" ADD CONSTRAINT "FK_2fd3843d21325cb115b90686562" FOREIGN KEY ("serviceId") REFERENCES "mail_services"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ADD CONSTRAINT "FK_b8c814dda28118c8a141863afff" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ADD CONSTRAINT "FK_71566c4e2836bea0d62bb7b4db2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "FK_34820ed355fa20cb6037e9cab78" FOREIGN KEY ("semesterId") REFERENCES "semester_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_section_mapping_model" ADD CONSTRAINT "FK_e0c220bbfe1eaf2f8488624853d" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "last_registration_model" ADD CONSTRAINT "FK_765fe567b826dd6ba406d802df6" FOREIGN KEY ("profId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prof_section_groups_model" ADD CONSTRAINT "FK_f4883601530ed63d8dcafea57d2" FOREIGN KEY ("profId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" ADD CONSTRAINT "FK_b47c12b782d3e463acdf841bbf7" FOREIGN KEY ("course") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_question_type_model" ADD CONSTRAINT "FK_f2bd3a8b19d3f7d47f11c746448" FOREIGN KEY ("questionId") REFERENCES "async_question_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_question_type_model" ADD CONSTRAINT "FK_50664d2df3841be1660871f04d8" FOREIGN KEY ("questionTypeId") REFERENCES "question_type_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model_staff_list_user_model" ADD CONSTRAINT "FK_2fd33d9360492e0ae1cc3332bde" FOREIGN KEY ("queueModelId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model_staff_list_user_model" ADD CONSTRAINT "FK_afc7595c6141d48fc334da22409" FOREIGN KEY ("userModelId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_question_type_model" ADD CONSTRAINT "FK_bc6bfc7f61c7bc23e0100179597" FOREIGN KEY ("questionId") REFERENCES "question_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_question_type_model" ADD CONSTRAINT "FK_3c8ba3b5a5d91391e20045e72ab" FOREIGN KEY ("questionTypeId") REFERENCES "question_type_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_question_type_model" DROP CONSTRAINT "FK_3c8ba3b5a5d91391e20045e72ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_question_type_model" DROP CONSTRAINT "FK_bc6bfc7f61c7bc23e0100179597"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model_staff_list_user_model" DROP CONSTRAINT "FK_afc7595c6141d48fc334da22409"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_model_staff_list_user_model" DROP CONSTRAINT "FK_2fd33d9360492e0ae1cc3332bde"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_question_type_model" DROP CONSTRAINT "FK_50664d2df3841be1660871f04d8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_question_type_model" DROP CONSTRAINT "FK_f2bd3a8b19d3f7d47f11c746448"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" DROP CONSTRAINT "FK_b47c12b782d3e463acdf841bbf7"`,
    );
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
      `ALTER TABLE "course_settings_model" DROP CONSTRAINT "FK_0b8c46d3c880227af25ce517ee2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" DROP CONSTRAINT "FK_71566c4e2836bea0d62bb7b4db2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" DROP CONSTRAINT "FK_b8c814dda28118c8a141863afff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP CONSTRAINT "FK_2fd3843d21325cb115b90686562"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP CONSTRAINT "FK_2dfab576863bc3f84d4f6962274"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" DROP CONSTRAINT "FK_00d27c247661185ee5c46b03412"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_task_progress_model" DROP CONSTRAINT "FK_e855cab9855b51519940f751262"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_token_model" DROP CONSTRAINT "FK_06d13508f10e479d1f99c2fb306"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" DROP CONSTRAINT "FK_25c224ece4509a7a4582357605f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" DROP CONSTRAINT "FK_d76bf27825067e1e6f83d7913fc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" DROP CONSTRAINT "FK_5d6af5a8f147be0ffb523ae9f58"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" DROP CONSTRAINT "FK_4fef22be04e7b58e8728a24b207"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_course_model" DROP CONSTRAINT "FK_a66ca3a1a5f8947ffeff3ff7f54"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" DROP CONSTRAINT "FK_bfbc6e5ef5e94a2545ef2d625ac"`,
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
      `ALTER TABLE "queue_invite_model" DROP CONSTRAINT "FK_4666f20b8ec1107f9973e966062"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP CONSTRAINT "FK_897f039518143a412251b010e3f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP CONSTRAINT "FK_a3ecde22b20f0416affdad4d0d3"`,
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
      `ALTER TABLE "async_question_votes_model" DROP CONSTRAINT "FK_eb178f187843117070809c574ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_votes_model" DROP CONSTRAINT "FK_001cf9c56d1fa2cb4d0963aecbb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" DROP CONSTRAINT "FK_a004c9c659f860bc2f64d107ab6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_group_model" DROP CONSTRAINT "FK_8c4bacefb7d000a0981dde66ed9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP CONSTRAINT "FK_3f38d8a85115b61789f02fc5c3b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP CONSTRAINT "FK_80faf01af81ddc3f4c17b6b6614"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insight_dashboard_model" DROP CONSTRAINT "FK_c5973ea9aade467a0d46aad78f5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3c8ba3b5a5d91391e20045e72a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bc6bfc7f61c7bc23e010017959"`,
    );
    await queryRunner.query(`DROP TABLE "question_question_type_model"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_afc7595c6141d48fc334da2240"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2fd33d9360492e0ae1cc3332bd"`,
    );
    await queryRunner.query(`DROP TABLE "queue_model_staff_list_user_model"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50664d2df3841be1660871f04d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f2bd3a8b19d3f7d47f11c74644"`,
    );
    await queryRunner.query(`DROP TABLE "async_question_question_type_model"`);
    await queryRunner.query(`DROP TABLE "config_model"`);
    await queryRunner.query(`DROP TABLE "calendar_model"`);
    await queryRunner.query(
      `DROP TYPE "public"."calendar_model_locationtype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "question_document_model"`);
    await queryRunner.query(`DROP TABLE "prof_section_groups_model"`);
    await queryRunner.query(`DROP TABLE "last_registration_model"`);
    await queryRunner.query(`DROP TABLE "course_section_mapping_model"`);
    await queryRunner.query(`DROP TABLE "course_model"`);
    await queryRunner.query(`DROP TABLE "course_settings_model"`);
    await queryRunner.query(`DROP TABLE "semester_model"`);
    await queryRunner.query(`DROP TABLE "alert_model"`);
    await queryRunner.query(`DROP TYPE "public"."alert_model_alerttype_enum"`);
    await queryRunner.query(`DROP TABLE "user_model"`);
    await queryRunner.query(`DROP TYPE "public"."user_model_userrole_enum"`);
    await queryRunner.query(`DROP TABLE "user_subscriptions"`);
    await queryRunner.query(`DROP TABLE "mail_services"`);
    await queryRunner.query(
      `DROP TYPE "public"."mail_services_servicetype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "student_task_progress_model"`);
    await queryRunner.query(`DROP TABLE "chat_token_model"`);
    await queryRunner.query(`DROP TABLE "user_token_model"`);
    await queryRunner.query(`DROP TABLE "organization_user_model"`);
    await queryRunner.query(
      `DROP TYPE "public"."organization_user_model_role_enum"`,
    );
    await queryRunner.query(`DROP TABLE "organization_model"`);
    await queryRunner.query(`DROP TABLE "organization_course_model"`);
    await queryRunner.query(`DROP TABLE "event_model"`);
    await queryRunner.query(`DROP TYPE "public"."event_model_eventtype_enum"`);
    await queryRunner.query(`DROP TABLE "desktop_notif_model"`);
    await queryRunner.query(`DROP TABLE "chatbot_interactions_model"`);
    await queryRunner.query(`DROP TABLE "chatbot_questions_model"`);
    await queryRunner.query(`DROP TABLE "question_model"`);
    await queryRunner.query(`DROP TABLE "queue_model"`);
    await queryRunner.query(`DROP TABLE "queue_invite_model"`);
    await queryRunner.query(`DROP TABLE "question_type_model"`);
    await queryRunner.query(`DROP TABLE "async_question_model"`);
    await queryRunner.query(`DROP TABLE "async_question_votes_model"`);
    await queryRunner.query(`DROP TABLE "question_group_model"`);
    await queryRunner.query(`DROP TABLE "user_course_model"`);
    await queryRunner.query(`DROP TYPE "public"."user_course_model_role_enum"`);
    await queryRunner.query(`DROP TABLE "insight_dashboard_model"`);
    await queryRunner.query(`DROP TABLE "admin_user_model"`);
  }
}
