import { Migration } from '@mikro-orm/migrations';

export class AddCommentsAndLikes1793648839376 extends Migration {
  override name = 'AddCommentsAndLikes1793648839376';

  override up(): void {
    this.addSql(
      `CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuidv7(), "content" text NOT NULL, "postId" uuid NOT NULL, "authorId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`,
    );
    this.addSql(
      `CREATE INDEX "IDX_e44ddaaa6d058cb4092f83ad61" ON "comments" ("postId") `,
    );
    this.addSql(
      `CREATE TYPE "public"."likes_likeabletype_enum" AS ENUM('post', 'comment')`,
    );
    this.addSql(
      `CREATE TABLE "likes" ("likeableType" "public"."likes_likeabletype_enum" NOT NULL, "likeableId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_53e67f5a58070e63eb6985bbd59" PRIMARY KEY ("likeableType", "likeableId", "userId"))`,
    );
    this.addSql(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    this.addSql(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_4548cc4a409b8651ec75f70e280" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    this.addSql(
      `ALTER TABLE "likes" ADD CONSTRAINT "FK_cfd8e81fac09d7339a32e57d904" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // likeableId cannot have a foreign key, so triggers clean up instead. They
    // also fire when a deleted post cascades to its comments.
    this.addSql(
      `CREATE FUNCTION "delete_likes"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN DELETE FROM "likes" WHERE "likeableType" = TG_ARGV[0]::"public"."likes_likeabletype_enum" AND "likeableId" = OLD."id"; RETURN OLD; END $$`,
    );
    this.addSql(
      `CREATE TRIGGER "posts_delete_likes" AFTER DELETE ON "posts" FOR EACH ROW EXECUTE FUNCTION "delete_likes"('post')`,
    );
    this.addSql(
      `CREATE TRIGGER "comments_delete_likes" AFTER DELETE ON "comments" FOR EACH ROW EXECUTE FUNCTION "delete_likes"('comment')`,
    );
  }

  override down(): void {
    this.addSql(`DROP TRIGGER "comments_delete_likes" ON "comments"`);
    this.addSql(`DROP TRIGGER "posts_delete_likes" ON "posts"`);
    this.addSql(`DROP FUNCTION "delete_likes"`);
    this.addSql(
      `ALTER TABLE "likes" DROP CONSTRAINT "FK_cfd8e81fac09d7339a32e57d904"`,
    );
    this.addSql(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_4548cc4a409b8651ec75f70e280"`,
    );
    this.addSql(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f"`,
    );
    this.addSql(`DROP TABLE "likes"`);
    this.addSql(`DROP TYPE "public"."likes_likeabletype_enum"`);
    this.addSql(`DROP INDEX "public"."IDX_e44ddaaa6d058cb4092f83ad61"`);
    this.addSql(`DROP TABLE "comments"`);
  }
}
