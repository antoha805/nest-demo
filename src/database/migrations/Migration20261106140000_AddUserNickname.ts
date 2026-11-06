import { Migration } from '@mikro-orm/migrations';

export class Migration20261106140000_AddUserNickname extends Migration {
  override name = 'Migration20261106140000_AddUserNickname';

  override up(): void {
    this.addSql(`ALTER TABLE "users" ADD "nickname" varchar(30) NULL`);
    // Existing users get a placeholder from the random end of their id.
    this.addSql(
      `UPDATE "users" SET "nickname" = 'user_' || right(replace("id"::text, '-', ''), 12)`,
    );
    this.addSql(`ALTER TABLE "users" ALTER COLUMN "nickname" SET NOT NULL`);
    this.addSql(
      `ALTER TABLE "users" ADD CONSTRAINT "users_nickname_unique" UNIQUE ("nickname")`,
    );
  }

  override down(): void {
    this.addSql(`ALTER TABLE "users" DROP COLUMN "nickname"`);
  }
}
