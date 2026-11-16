import { Migration } from '@mikro-orm/migrations';

// Publishing is final, so one date says both whether a post is published and
// that it has been announced.
export class Migration20261117120000_ReplacePostPublishedWithPublishedAt extends Migration {
  override name = 'Migration20261117120000_ReplacePostPublishedWithPublishedAt';

  override up(): void {
    this.addSql(`ALTER TABLE "posts" ADD "publishedAt" timestamptz NULL`);
    this.addSql(
      `UPDATE "posts" SET "publishedAt" = COALESCE("announcedAt", "createdAt") WHERE "published"`,
    );
    this.addSql(
      `ALTER TABLE "posts" DROP COLUMN "published", DROP COLUMN "announcedAt"`,
    );
  }

  override down(): void {
    this.addSql(
      `ALTER TABLE "posts" ADD "published" boolean NOT NULL DEFAULT false, ADD "announcedAt" timestamptz NULL`,
    );
    this.addSql(
      `UPDATE "posts" SET "published" = true, "announcedAt" = "publishedAt" WHERE "publishedAt" IS NOT NULL`,
    );
    this.addSql(`ALTER TABLE "posts" DROP COLUMN "publishedAt"`);
  }
}
