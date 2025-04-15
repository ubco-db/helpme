import { MigrationInterface, QueryRunner } from 'typeorm';

export class addedFavouritedColumnToUserCourseModel1742770456081
  implements MigrationInterface
{
  name = 'addedFavouritedColumnToUserCourseModel1742770456081';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD "favourited" boolean DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP COLUMN "favourited"`,
    );
  }
}
