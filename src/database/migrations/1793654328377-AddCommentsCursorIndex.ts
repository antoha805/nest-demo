import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentsCursorIndex1793654328377 implements MigrationInterface {
  name = 'AddCommentsCursorIndex1793654328377';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e44ddaaa6d058cb4092f83ad61"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9fedf58adcfb0eaac5d470ba6c" ON "comments" ("postId", "id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9fedf58adcfb0eaac5d470ba6c"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e44ddaaa6d058cb4092f83ad61" ON "comments" ("postId") `,
    );
  }
}
