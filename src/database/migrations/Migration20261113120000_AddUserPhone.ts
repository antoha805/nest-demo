import { Migration } from '@mikro-orm/migrations';

export class Migration20261113120000_AddUserPhone extends Migration {
  override name = 'Migration20261113120000_AddUserPhone';

  override up(): void {
    this.addSql(`ALTER TABLE "users" ADD "phone" varchar(16) NULL`);
  }

  override down(): void {
    this.addSql(`ALTER TABLE "users" DROP COLUMN "phone"`);
  }
}
