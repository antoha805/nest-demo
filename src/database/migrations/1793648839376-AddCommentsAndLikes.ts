import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentsAndLikes1793648839376 implements MigrationInterface {
  name = 'AddCommentsAndLikes1793648839376';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuidv7(), "content" text NOT NULL, "postId" uuid NOT NULL, "authorId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e44ddaaa6d058cb4092f83ad61" ON "comments" ("postId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."likes_likeabletype_enum" AS ENUM('post', 'comment')`,
    );
    await queryRunner.query(
      `CREATE TABLE "likes" ("likeableType" "public"."likes_likeabletype_enum" NOT NULL, "likeableId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_53e67f5a58070e63eb6985bbd59" PRIMARY KEY ("likeableType", "likeableId", "userId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_4548cc4a409b8651ec75f70e280" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "likes" ADD CONSTRAINT "FK_cfd8e81fac09d7339a32e57d904" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // likeableId cannot have a foreign key, so triggers clean up instead. They
    // also fire when a deleted post cascades to its comments.
    await queryRunner.query(
      `CREATE FUNCTION "delete_likes"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN DELETE FROM "likes" WHERE "likeableType" = TG_ARGV[0]::"public"."likes_likeabletype_enum" AND "likeableId" = OLD."id"; RETURN OLD; END $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "posts_delete_likes" AFTER DELETE ON "posts" FOR EACH ROW EXECUTE FUNCTION "delete_likes"('post')`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "comments_delete_likes" AFTER DELETE ON "comments" FOR EACH ROW EXECUTE FUNCTION "delete_likes"('comment')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "comments_delete_likes" ON "comments"`,
    );
    await queryRunner.query(`DROP TRIGGER "posts_delete_likes" ON "posts"`);
    await queryRunner.query(`DROP FUNCTION "delete_likes"`);
    await queryRunner.query(
      `ALTER TABLE "likes" DROP CONSTRAINT "FK_cfd8e81fac09d7339a32e57d904"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_4548cc4a409b8651ec75f70e280"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f"`,
    );
    await queryRunner.query(`DROP TABLE "likes"`);
    await queryRunner.query(`DROP TYPE "public"."likes_likeabletype_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e44ddaaa6d058cb4092f83ad61"`,
    );
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}
