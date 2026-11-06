import { Migration } from '@mikro-orm/migrations';

export class AddAuthorization1793478323281 extends Migration {
  override name = 'AddAuthorization1793478323281';

  override up(): void {
    this.addSql(
      `CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuidv7(), "name" character varying(100) NOT NULL, CONSTRAINT "UQ_48ce552495d14eae9b187bb6716" UNIQUE ("name"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    this.addSql(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuidv7(), "name" character varying(100) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    this.addSql(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuidv7(), "email" character varying(254) NOT NULL, "passwordHash" character varying(60) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    this.addSql(
      `CREATE TABLE "role_permissions" ("roleId" uuid NOT NULL, "permissionId" uuid NOT NULL, CONSTRAINT "PK_d430a02aad006d8a70f3acd7d03" PRIMARY KEY ("roleId", "permissionId"))`,
    );
    this.addSql(
      `CREATE INDEX "IDX_b4599f8b8f548d35850afa2d12" ON "role_permissions" ("roleId") `,
    );
    this.addSql(
      `CREATE INDEX "IDX_06792d0c62ce6b0203c03643cd" ON "role_permissions" ("permissionId") `,
    );
    this.addSql(
      `CREATE TABLE "user_roles" ("userId" uuid NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "PK_88481b0c4ed9ada47e9fdd67475" PRIMARY KEY ("userId", "roleId"))`,
    );
    this.addSql(
      `CREATE INDEX "IDX_472b25323af01488f1f66a06b6" ON "user_roles" ("userId") `,
    );
    this.addSql(
      `CREATE INDEX "IDX_86033897c009fcca8b6505d6be" ON "user_roles" ("roleId") `,
    );
    this.addSql(
      `CREATE TABLE "user_permissions" ("userId" uuid NOT NULL, "permissionId" uuid NOT NULL, CONSTRAINT "PK_4d0e283b03781d1796e62dc6195" PRIMARY KEY ("userId", "permissionId"))`,
    );
    this.addSql(
      `CREATE INDEX "IDX_f05ccc7935f14874d7f89ba030" ON "user_permissions" ("userId") `,
    );
    this.addSql(
      `CREATE INDEX "IDX_cf38f85e52ee274ba9a01901ed" ON "user_permissions" ("permissionId") `,
    );
    this.addSql(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_b4599f8b8f548d35850afa2d12c" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    this.addSql(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_06792d0c62ce6b0203c03643cdd" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    this.addSql(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_472b25323af01488f1f66a06b67" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    this.addSql(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_86033897c009fcca8b6505d6be2" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    this.addSql(
      `ALTER TABLE "user_permissions" ADD CONSTRAINT "FK_f05ccc7935f14874d7f89ba030f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    this.addSql(
      `ALTER TABLE "user_permissions" ADD CONSTRAINT "FK_cf38f85e52ee274ba9a01901ed2" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  override down(): void {
    this.addSql(
      `ALTER TABLE "user_permissions" DROP CONSTRAINT "FK_cf38f85e52ee274ba9a01901ed2"`,
    );
    this.addSql(
      `ALTER TABLE "user_permissions" DROP CONSTRAINT "FK_f05ccc7935f14874d7f89ba030f"`,
    );
    this.addSql(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_86033897c009fcca8b6505d6be2"`,
    );
    this.addSql(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_472b25323af01488f1f66a06b67"`,
    );
    this.addSql(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_06792d0c62ce6b0203c03643cdd"`,
    );
    this.addSql(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_b4599f8b8f548d35850afa2d12c"`,
    );
    this.addSql(`DROP INDEX "public"."IDX_cf38f85e52ee274ba9a01901ed"`);
    this.addSql(`DROP INDEX "public"."IDX_f05ccc7935f14874d7f89ba030"`);
    this.addSql(`DROP TABLE "user_permissions"`);
    this.addSql(`DROP INDEX "public"."IDX_86033897c009fcca8b6505d6be"`);
    this.addSql(`DROP INDEX "public"."IDX_472b25323af01488f1f66a06b6"`);
    this.addSql(`DROP TABLE "user_roles"`);
    this.addSql(`DROP INDEX "public"."IDX_06792d0c62ce6b0203c03643cd"`);
    this.addSql(`DROP INDEX "public"."IDX_b4599f8b8f548d35850afa2d12"`);
    this.addSql(`DROP TABLE "role_permissions"`);
    this.addSql(`DROP TABLE "users"`);
    this.addSql(`DROP TABLE "roles"`);
    this.addSql(`DROP TABLE "permissions"`);
  }
}
