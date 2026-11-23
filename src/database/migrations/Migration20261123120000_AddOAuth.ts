import { Migration } from '@mikro-orm/migrations';

export class Migration20261123120000_AddOAuth extends Migration {
  override name = 'Migration20261123120000_AddOAuth';

  override up(): void {
    this.addSql(
      `CREATE TABLE "oauth_clients" ("id" uuid NOT NULL, "information" jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id"))`,
    );

    this.addSql(
      `CREATE TABLE "oauth_authorization_codes" ("codeHash" varchar(64) NOT NULL, "clientId" uuid NOT NULL, "userId" uuid NOT NULL, "scope" varchar(255) NOT NULL, "redirectUri" text NOT NULL, "codeChallenge" varchar(128) NOT NULL, "expiresAt" timestamptz NOT NULL, CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("codeHash"))`,
    );
    this.addSql(
      `ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_clientId_foreign" FOREIGN KEY ("clientId") REFERENCES "oauth_clients" ("id") ON UPDATE NO ACTION ON DELETE CASCADE`,
    );
    this.addSql(
      `ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_userId_foreign" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE`,
    );

    this.addSql(
      `CREATE TABLE "oauth_grants" ("id" uuid NOT NULL DEFAULT uuidv7(), "clientId" uuid NOT NULL, "userId" uuid NOT NULL, "scope" varchar(255) NOT NULL, "refreshTokenHash" varchar(64) NOT NULL, "previousRefreshTokenHash" varchar(64) NULL, "expiresAt" timestamptz NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "oauth_grants_pkey" PRIMARY KEY ("id"))`,
    );
    this.addSql(
      `ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_refreshTokenHash_unique" UNIQUE ("refreshTokenHash")`,
    );
    this.addSql(
      `ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_previousRefreshTokenHash_unique" UNIQUE ("previousRefreshTokenHash")`,
    );
    this.addSql(
      `ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_clientId_foreign" FOREIGN KEY ("clientId") REFERENCES "oauth_clients" ("id") ON UPDATE NO ACTION ON DELETE CASCADE`,
    );
    this.addSql(
      `ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_userId_foreign" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE`,
    );
  }

  override down(): void {
    this.addSql(`DROP TABLE "oauth_grants"`);
    this.addSql(`DROP TABLE "oauth_authorization_codes"`);
    this.addSql(`DROP TABLE "oauth_clients"`);
  }
}
