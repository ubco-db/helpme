import { MigrationInterface, QueryRunner } from 'typeorm';

export class removeOrganizationUserModel1738106924799
  implements MigrationInterface
{
  name = 'removeOrganizationUserModel1738106924799';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
