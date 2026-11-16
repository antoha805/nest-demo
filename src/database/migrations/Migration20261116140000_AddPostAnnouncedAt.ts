import { Migration } from '@mikro-orm/migrations';

export class Migration20261116140000_AddPostAnnouncedAt extends Migration {
  override name = 'Migration20261116140000_AddPostAnnouncedAt';

  override up(): void {
    this.addSql(`ALTER TABLE "posts" ADD "announcedAt" timestamptz NULL`);
    // Published before announcements existed, so publishing one again after
    // unpublishing it does not announce it late.
    this.addSql(
      `UPDATE "posts" SET "announcedAt" = "createdAt" WHERE "published"`,
    );
  }

  override down(): void {
    this.addSql(`ALTER TABLE "posts" DROP COLUMN "announcedAt"`);
  }
}
