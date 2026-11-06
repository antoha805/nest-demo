import { Migration } from '@mikro-orm/migrations';

export class Migration20261106150000_AddNotifications extends Migration {
  override name = 'Migration20261106150000_AddNotifications';

  override up(): void {
    this.addSql(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuidv7(), "userId" uuid NOT NULL, "type" varchar(100) NOT NULL, "data" jsonb NOT NULL, "readAt" timestamptz NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"))`,
    );
    this.addSql(
      `CREATE INDEX "notifications_userId_id_index" ON "notifications" ("userId", "id")`,
    );
    this.addSql(
      `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_foreign" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE`,
    );
  }

  override down(): void {
    this.addSql(`DROP TABLE "notifications"`);
  }
}
