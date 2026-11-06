import { Migration } from '@mikro-orm/migrations';

// TypeORM's record of its migrations. migrate.ts copies it before any migration
// runs, so it is no longer needed. Reverting restores it, so that the previous
// version, which used TypeORM, can be deployed again.
export class Migration20261106130000_DropTypeOrmMigrations extends Migration {
  override name = 'Migration20261106130000_DropTypeOrmMigrations';

  override up(): void {
    this.addSql(`DROP TABLE IF EXISTS "migrations"`);
  }

  override down(): void {
    this.addSql(
      `CREATE TABLE "migrations" ("id" SERIAL NOT NULL, "timestamp" bigint NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id"))`,
    );
    this.addSql(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES (1793397800067, 'InitialSchema1793397800067'), (1793478323281, 'AddAuthorization1793478323281'), (1793480324637, 'AddPostAuthor1793480324637'), (1793648839376, 'AddCommentsAndLikes1793648839376'), (1793653886382, 'AddPostCategoryIndex1793653886382'), (1793654328377, 'AddCommentsCursorIndex1793654328377')`,
    );
  }
}
