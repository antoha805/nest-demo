import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostCategoryIndex1793653886382 implements MigrationInterface {
  name = 'AddPostCategoryIndex1793653886382';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_168bf21b341e2ae340748e2541" ON "posts" ("categoryId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_168bf21b341e2ae340748e2541"`,
    );
  }
}
