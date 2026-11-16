import { Migration } from '@mikro-orm/migrations';

// Points notifications to their notifiable by type and id, like Laravel's
// morphs('notifiable'). The existing ones are all for users.
export class Migration20261116120000_MakeNotificationsPolymorphic extends Migration {
  override name = 'Migration20261116120000_MakeNotificationsPolymorphic';

  override up(): void {
    this.addSql(
      `CREATE TYPE "notifications_notifiabletype_enum" AS ENUM('user')`,
    );
    this.addSql(
      `ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_foreign"`,
    );
    this.addSql(`DROP INDEX "notifications_userId_id_index"`);
    this.addSql(
      `ALTER TABLE "notifications" RENAME COLUMN "userId" TO "notifiableId"`,
    );
    this.addSql(
      `ALTER TABLE "notifications" ADD "notifiableType" "notifications_notifiabletype_enum" NOT NULL DEFAULT 'user'`,
    );
    this.addSql(
      `ALTER TABLE "notifications" ALTER COLUMN "notifiableType" DROP DEFAULT`,
    );
    this.addSql(
      `CREATE INDEX "notifications_notifiableType_notifiableId_id_index" ON "notifications" ("notifiableType", "notifiableId", "id")`,
    );
    // notifiableId cannot have a foreign key, so triggers clean up instead, as
    // they do for likes.
    this.addSql(
      `CREATE FUNCTION "delete_notifications"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN DELETE FROM "notifications" WHERE "notifiableType" = TG_ARGV[0]::"notifications_notifiabletype_enum" AND "notifiableId" = OLD."id"; RETURN OLD; END $$`,
    );
    this.addSql(
      `CREATE TRIGGER "users_delete_notifications" AFTER DELETE ON "users" FOR EACH ROW EXECUTE FUNCTION "delete_notifications"('user')`,
    );
  }

  override down(): void {
    this.addSql(`DROP TRIGGER "users_delete_notifications" ON "users"`);
    this.addSql(`DROP FUNCTION "delete_notifications"`);
    // Only users had notifications before.
    this.addSql(`DELETE FROM "notifications" WHERE "notifiableType" <> 'user'`);
    this.addSql(
      `DROP INDEX "notifications_notifiableType_notifiableId_id_index"`,
    );
    this.addSql(`ALTER TABLE "notifications" DROP COLUMN "notifiableType"`);
    this.addSql(
      `ALTER TABLE "notifications" RENAME COLUMN "notifiableId" TO "userId"`,
    );
    this.addSql(
      `CREATE INDEX "notifications_userId_id_index" ON "notifications" ("userId", "id")`,
    );
    this.addSql(
      `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_foreign" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE`,
    );
    this.addSql(`DROP TYPE "notifications_notifiabletype_enum"`);
  }
}
