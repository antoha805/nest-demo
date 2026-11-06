import { Migration } from '@mikro-orm/migrations';

export class Migration20261106160000_AddEmailVerification extends Migration {
  override name = 'Migration20261106160000_AddEmailVerification';

  override up(): void {
    this.addSql(`ALTER TABLE "users" ADD "emailVerifiedAt" timestamptz NULL`);
    // Existing users signed up before confirmation, so they keep their access.
    this.addSql(`UPDATE "users" SET "emailVerifiedAt" = "createdAt"`);
    this.addSql(
      `CREATE TABLE "email_verifications" ("userId" uuid NOT NULL, "codeHash" varchar(64) NOT NULL, "attempts" int NOT NULL DEFAULT 0, "expiresAt" timestamptz NOT NULL, "sentAt" timestamptz NOT NULL, CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("userId"))`,
    );
    this.addSql(
      `ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_userId_foreign" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE`,
    );
  }

  override down(): void {
    this.addSql(`DROP TABLE "email_verifications"`);
    this.addSql(`ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"`);
  }
}
