import { Migration } from '@mikro-orm/migrations';

// Renames the keys, constraints and indexes from TypeORM's hashed names to those
// MikroORM generates, so its schema diff only shows real changes.
export class Migration20261106120000_AdoptMikroOrmNames extends Migration {
  override name = 'Migration20261106120000_AdoptMikroOrmNames';

  override up(): void {
    this.addSql(
      `ALTER TABLE "categories" RENAME CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" TO "categories_pkey"`,
    );
    this.addSql(
      `ALTER TABLE "posts" RENAME CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" TO "posts_pkey"`,
    );
    this.addSql(
      `ALTER TABLE "comments" RENAME CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" TO "comments_pkey"`,
    );
    this.addSql(
      `ALTER TABLE "likes" RENAME CONSTRAINT "PK_53e67f5a58070e63eb6985bbd59" TO "likes_pkey"`,
    );
    this.addSql(
      `ALTER TABLE "users" RENAME CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" TO "users_pkey"`,
    );
    this.addSql(
      `ALTER TABLE "roles" RENAME CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" TO "roles_pkey"`,
    );
    this.addSql(
      `ALTER TABLE "permissions" RENAME CONSTRAINT "PK_920331560282b8bd21bb02290df" TO "permissions_pkey"`,
    );
    this.addSql(
      `ALTER TABLE "user_roles" RENAME CONSTRAINT "PK_88481b0c4ed9ada47e9fdd67475" TO "user_roles_pkey"`,
    );
    this.addSql(
      `ALTER TABLE "user_permissions" RENAME CONSTRAINT "PK_4d0e283b03781d1796e62dc6195" TO "user_permissions_pkey"`,
    );
    this.addSql(
      `ALTER TABLE "role_permissions" RENAME CONSTRAINT "PK_d430a02aad006d8a70f3acd7d03" TO "role_permissions_pkey"`,
    );
    this.addSql(
      `ALTER TABLE "categories" RENAME CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" TO "categories_name_unique"`,
    );
    this.addSql(
      `ALTER TABLE "users" RENAME CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" TO "users_email_unique"`,
    );
    this.addSql(
      `ALTER TABLE "roles" RENAME CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" TO "roles_name_unique"`,
    );
    this.addSql(
      `ALTER TABLE "permissions" RENAME CONSTRAINT "UQ_48ce552495d14eae9b187bb6716" TO "permissions_name_unique"`,
    );
    this.addSql(
      `ALTER TABLE "posts" RENAME CONSTRAINT "FK_168bf21b341e2ae340748e2541d" TO "posts_categoryId_foreign"`,
    );
    this.addSql(
      `ALTER TABLE "posts" RENAME CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e" TO "posts_authorId_foreign"`,
    );
    this.addSql(
      `ALTER TABLE "comments" RENAME CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f" TO "comments_postId_foreign"`,
    );
    this.addSql(
      `ALTER TABLE "comments" RENAME CONSTRAINT "FK_4548cc4a409b8651ec75f70e280" TO "comments_authorId_foreign"`,
    );
    this.addSql(
      `ALTER TABLE "likes" RENAME CONSTRAINT "FK_cfd8e81fac09d7339a32e57d904" TO "likes_userId_foreign"`,
    );
    this.addSql(
      `ALTER TABLE "user_roles" RENAME CONSTRAINT "FK_472b25323af01488f1f66a06b67" TO "user_roles_userId_foreign"`,
    );
    this.addSql(
      `ALTER TABLE "user_roles" RENAME CONSTRAINT "FK_86033897c009fcca8b6505d6be2" TO "user_roles_roleId_foreign"`,
    );
    this.addSql(
      `ALTER TABLE "user_permissions" RENAME CONSTRAINT "FK_f05ccc7935f14874d7f89ba030f" TO "user_permissions_userId_foreign"`,
    );
    this.addSql(
      `ALTER TABLE "user_permissions" RENAME CONSTRAINT "FK_cf38f85e52ee274ba9a01901ed2" TO "user_permissions_permissionId_foreign"`,
    );
    this.addSql(
      `ALTER TABLE "role_permissions" RENAME CONSTRAINT "FK_b4599f8b8f548d35850afa2d12c" TO "role_permissions_roleId_foreign"`,
    );
    this.addSql(
      `ALTER TABLE "role_permissions" RENAME CONSTRAINT "FK_06792d0c62ce6b0203c03643cdd" TO "role_permissions_permissionId_foreign"`,
    );
    this.addSql(
      `ALTER INDEX "IDX_168bf21b341e2ae340748e2541" RENAME TO "posts_categoryId_index"`,
    );
    this.addSql(
      `ALTER INDEX "IDX_9fedf58adcfb0eaac5d470ba6c" RENAME TO "comments_postId_id_index"`,
    );
    // MikroORM does not index the columns of join tables separately. The first
    // column of each is already covered by the primary key, and the second only
    // speeds up deleting a role or permission, which the small tables do not need.
    this.addSql(`DROP INDEX "IDX_472b25323af01488f1f66a06b6"`);
    this.addSql(`DROP INDEX "IDX_86033897c009fcca8b6505d6be"`);
    this.addSql(`DROP INDEX "IDX_f05ccc7935f14874d7f89ba030"`);
    this.addSql(`DROP INDEX "IDX_cf38f85e52ee274ba9a01901ed"`);
    this.addSql(`DROP INDEX "IDX_b4599f8b8f548d35850afa2d12"`);
    this.addSql(`DROP INDEX "IDX_06792d0c62ce6b0203c03643cd"`);
  }

  override down(): void {
    this.addSql(
      `CREATE INDEX "IDX_472b25323af01488f1f66a06b6" ON "user_roles" ("userId")`,
    );
    this.addSql(
      `CREATE INDEX "IDX_86033897c009fcca8b6505d6be" ON "user_roles" ("roleId")`,
    );
    this.addSql(
      `CREATE INDEX "IDX_f05ccc7935f14874d7f89ba030" ON "user_permissions" ("userId")`,
    );
    this.addSql(
      `CREATE INDEX "IDX_cf38f85e52ee274ba9a01901ed" ON "user_permissions" ("permissionId")`,
    );
    this.addSql(
      `CREATE INDEX "IDX_b4599f8b8f548d35850afa2d12" ON "role_permissions" ("roleId")`,
    );
    this.addSql(
      `CREATE INDEX "IDX_06792d0c62ce6b0203c03643cd" ON "role_permissions" ("permissionId")`,
    );
    this.addSql(
      `ALTER INDEX "posts_categoryId_index" RENAME TO "IDX_168bf21b341e2ae340748e2541"`,
    );
    this.addSql(
      `ALTER INDEX "comments_postId_id_index" RENAME TO "IDX_9fedf58adcfb0eaac5d470ba6c"`,
    );
    this.addSql(
      `ALTER TABLE "categories" RENAME CONSTRAINT "categories_pkey" TO "PK_24dbc6126a28ff948da33e97d3b"`,
    );
    this.addSql(
      `ALTER TABLE "posts" RENAME CONSTRAINT "posts_pkey" TO "PK_2829ac61eff60fcec60d7274b9e"`,
    );
    this.addSql(
      `ALTER TABLE "comments" RENAME CONSTRAINT "comments_pkey" TO "PK_8bf68bc960f2b69e818bdb90dcb"`,
    );
    this.addSql(
      `ALTER TABLE "likes" RENAME CONSTRAINT "likes_pkey" TO "PK_53e67f5a58070e63eb6985bbd59"`,
    );
    this.addSql(
      `ALTER TABLE "users" RENAME CONSTRAINT "users_pkey" TO "PK_a3ffb1c0c8416b9fc6f907b7433"`,
    );
    this.addSql(
      `ALTER TABLE "roles" RENAME CONSTRAINT "roles_pkey" TO "PK_c1433d71a4838793a49dcad46ab"`,
    );
    this.addSql(
      `ALTER TABLE "permissions" RENAME CONSTRAINT "permissions_pkey" TO "PK_920331560282b8bd21bb02290df"`,
    );
    this.addSql(
      `ALTER TABLE "user_roles" RENAME CONSTRAINT "user_roles_pkey" TO "PK_88481b0c4ed9ada47e9fdd67475"`,
    );
    this.addSql(
      `ALTER TABLE "user_permissions" RENAME CONSTRAINT "user_permissions_pkey" TO "PK_4d0e283b03781d1796e62dc6195"`,
    );
    this.addSql(
      `ALTER TABLE "role_permissions" RENAME CONSTRAINT "role_permissions_pkey" TO "PK_d430a02aad006d8a70f3acd7d03"`,
    );
    this.addSql(
      `ALTER TABLE "categories" RENAME CONSTRAINT "categories_name_unique" TO "UQ_8b0be371d28245da6e4f4b61878"`,
    );
    this.addSql(
      `ALTER TABLE "users" RENAME CONSTRAINT "users_email_unique" TO "UQ_97672ac88f789774dd47f7c8be3"`,
    );
    this.addSql(
      `ALTER TABLE "roles" RENAME CONSTRAINT "roles_name_unique" TO "UQ_648e3f5447f725579d7d4ffdfb7"`,
    );
    this.addSql(
      `ALTER TABLE "permissions" RENAME CONSTRAINT "permissions_name_unique" TO "UQ_48ce552495d14eae9b187bb6716"`,
    );
    this.addSql(
      `ALTER TABLE "posts" RENAME CONSTRAINT "posts_categoryId_foreign" TO "FK_168bf21b341e2ae340748e2541d"`,
    );
    this.addSql(
      `ALTER TABLE "posts" RENAME CONSTRAINT "posts_authorId_foreign" TO "FK_c5a322ad12a7bf95460c958e80e"`,
    );
    this.addSql(
      `ALTER TABLE "comments" RENAME CONSTRAINT "comments_postId_foreign" TO "FK_e44ddaaa6d058cb4092f83ad61f"`,
    );
    this.addSql(
      `ALTER TABLE "comments" RENAME CONSTRAINT "comments_authorId_foreign" TO "FK_4548cc4a409b8651ec75f70e280"`,
    );
    this.addSql(
      `ALTER TABLE "likes" RENAME CONSTRAINT "likes_userId_foreign" TO "FK_cfd8e81fac09d7339a32e57d904"`,
    );
    this.addSql(
      `ALTER TABLE "user_roles" RENAME CONSTRAINT "user_roles_userId_foreign" TO "FK_472b25323af01488f1f66a06b67"`,
    );
    this.addSql(
      `ALTER TABLE "user_roles" RENAME CONSTRAINT "user_roles_roleId_foreign" TO "FK_86033897c009fcca8b6505d6be2"`,
    );
    this.addSql(
      `ALTER TABLE "user_permissions" RENAME CONSTRAINT "user_permissions_userId_foreign" TO "FK_f05ccc7935f14874d7f89ba030f"`,
    );
    this.addSql(
      `ALTER TABLE "user_permissions" RENAME CONSTRAINT "user_permissions_permissionId_foreign" TO "FK_cf38f85e52ee274ba9a01901ed2"`,
    );
    this.addSql(
      `ALTER TABLE "role_permissions" RENAME CONSTRAINT "role_permissions_roleId_foreign" TO "FK_b4599f8b8f548d35850afa2d12c"`,
    );
    this.addSql(
      `ALTER TABLE "role_permissions" RENAME CONSTRAINT "role_permissions_permissionId_foreign" TO "FK_06792d0c62ce6b0203c03643cdd"`,
    );
  }
}
