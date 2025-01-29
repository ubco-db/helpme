import { MigrationInterface, QueryRunner } from 'typeorm';
import { UserModel } from '../src/profile/user.entity';

export class removeOrganizationUserModel1738106924799
  implements MigrationInterface
{
  name = 'removeOrganizationUserModel1738106924799';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /*
    Irreversible operation to collapse accounts with collisions
    (e.g., accounts with same normalized email address and organization ID)
    into one account
     */
    const emailsWithCollisions: {
      normalizedEmail: string;
      organizationId: number;
    }[] = await queryRunner.query(`
      SELECT UPPER("email") AS "normalizedEmail", "organizationId"
      FROM "user_model" JOIN "organization_user_model" ON "user_model"."id" = "organization_user_model"."userId"
      GROUP BY UPPER("email"), "organizationId"
      HAVING COUNT(UPPER("email")) > 1;
    `);
    for (const email of emailsWithCollisions) {
      const matchingUsers = await queryRunner.manager
        .createQueryBuilder(UserModel, 'um')
        .select()
        .where('UPPER("um"."email") = :email', { email })
        .orderBy('id', 'ASC')
        .getMany();
      if (matchingUsers.length > 0) {
        const primeUser = matchingUsers[0];
        const otherUsers = matchingUsers.slice(1);
        for (const otherUser of otherUsers) {
          // This might be overkill, but I don't know when this will finally end up being run
          // No idea how many collisions there will be by then
          // Update each table with a FK to user's ID column to grant the 'prime' user ownership
          await queryRunner.manager.query(`
            UPDATE "alert_model" SET "userId" = ${primeUser.id} WHERE "userId" = ${otherUser.id};
            UPDATE "async_question_model" SET "creatorId" = ${primeUser.id} WHERE "creatorId" = ${otherUser.id};
            UPDATE "async_question_model" SET "taHelpedId" = ${primeUser.id} WHERE "taHelpedId" = ${otherUser.id};
            UPDATE "async_question_votes_model" SET "userId" = ${primeUser.id} WHERE "userId" = ${otherUser.id}
            UPDATE "calendar_staff_model" SET "userId" = ${primeUser.id} WHERE "userId" = ${otherUser.id};
            UPDATE "chat_token_model" SET "user" = ${primeUser.id} WHERE "user" = ${otherUser.id};
            UPDATE "chatbot_interactions_model" SET "user" = ${primeUser.id} WHERE "user" = ${otherUser.id};
            UPDATE "desktop_notif_model" SET "userId" = ${primeUser.id} WHERE "userId" = ${otherUser.id};
            UPDATE "event_model" SET "userId" = ${primeUser.id} WHERE "userId" = ${otherUser.id};
            UPDATE "question_group_model" SET "creatorId" = ${primeUser.id} WHERE "creatorId" = ${otherUser.id};
            UPDATE "question_model" SET "creatorId" = ${primeUser.id} WHERE "creatorId" = ${otherUser.id};
            UPDATE "question_model" SET "taHelpedId" = ${primeUser.id} WHERE "taHelpedId" = ${otherUser.id};
            UPDATE "queue_model_staff_list_user_model" SET "userModelId" = ${primeUser.id} WHERE "userModelId" = ${otherUser.id};
            UPDATE "student_task_progress_model" SET "uid" = ${primeUser.id} WHERE "uid" = ${otherUser.id};
            UPDATE "user_course_model" SET "userId" = ${primeUser.id} WHERE "userId" = ${otherUser.id};
            UPDATE "user_subscriptions" SET "userId" = ${primeUser.id} WHERE "userId" = ${otherUser.id};
            UPDATE "user_token_model" SET "userId" = ${primeUser.id} WHERE "userId" = ${otherUser.id};

            DELETE FROM user_model WHERE "id" = ${otherUser.id}
          `);
        }
      }
    }

    const usersWithCollisions = queryRunner.manager
      .createQueryBuilder(UserModel, 'UserModel')
      .select()
      .where('UPPER("UserModel"."email")');

    /*
    Query(ies) to transfer columns from and drop the OrganizationUserModel, and create the normalizedEmail column,
     */
    await queryRunner.query(
      `
        ALTER TABLE "user_model" ADD "normalizedEmail" TEXT;
        UPDATE "user_model" SET "normalizedEmail" = UPPER("email");
        ALTER TABLE "user_model" ALTER COLUMN "normalizedEmail" SET NOT NULL;

        CREATE TYPE "public"."user_model_organization_role" AS ENUM('member', 'admin', 'professor');
        ALTER TABLE "user_model" ADD "organizationId" INTEGER;
        ALTER TABLE "user_model" ADD "organizationRole" "public"."user_model_organization_role" NOT NULL DEFAULT 'member';
        
        UPDATE "user_model" SET "organizationId" = "subquery"."organizationId", "organizationRole" = "subquery"."role"::TEXT::"public"."user_model_organization_role"
            FROM (SELECT "organization_user_model"."userId", "organization_user_model"."organizationId", "organization_user_model"."role" 
                  FROM "organization_user_model") AS "subquery"
            WHERE "user_model"."id" = "subquery"."userId";
        
        ALTER TABLE "user_model" ADD CONSTRAINT "FK_userToOrganizationForeignKey" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        ALTER TABLE "user_model" ADD CONSTRAINT "UQ_userEmailOrganizationId" UNIQUE ("normalizedEmail","organizationId");
        
        DROP TABLE "organization_user_model";
        
        DROP TYPE "public"."organization_user_model_role_enum";
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        CREATE TYPE "public"."organization_user_model_role_enum" AS ENUM('member', 'admin', 'professor');
        CREATE TABLE "organization_user_model" ("id" SERIAL NOT NULL, "userId" integer, "organizationId" integer, "role" "public"."organization_user_model_role_enum" NOT NULL DEFAULT 'member', CONSTRAINT "PK_5611727c18cc918add73c20efc6" PRIMARY KEY ("id"));
        
        ALTER TABLE "organization_user_model" ADD CONSTRAINT "FK_5d6af5a8f147be0ffb523ae9f58" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        ALTER TABLE "organization_user_model" ADD CONSTRAINT "UQ_d76bf27825067e1e6f83d7913fc" UNIQUE ("userId");
        ALTER TABLE "organization_user_model" ADD CONSTRAINT "FK_d76bf27825067e1e6f83d7913fc" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        
        INSERT INTO "organization_user_model" ("organizationId", "userId", "role")
        SELECT "user_model"."organizationId", "user_model"."id" AS "userId", "user_model"."organizationRole"::TEXT::"public"."organization_user_model_role_enum" as "role"
        FROM "user_model";
        
        ALTER TABLE "user_model" DROP CONSTRAINT "FK_userToOrganizationForeignKey";
        ALTER TABLE "user_model" DROP CONSTRAINT "UQ_userEmailOrganizationId";
        ALTER TABLE "user_model" DROP COLUMN "normalizedEmail";
        ALTER TABLE "user_model" DROP COLUMN "organizationId";
        ALTER TABLE "user_model" DROP COLUMN "organizationRole";
        
        DROP TYPE "public"."user_model_organization_role";
      `,
    );
  }
}
