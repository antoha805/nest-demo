import { Migration } from '@mikro-orm/migrations';

export class AddPostCategoryIndex1793653886382 extends Migration {
  override name = 'AddPostCategoryIndex1793653886382';

  override up(): void {
    this.addSql(
      `CREATE INDEX "IDX_168bf21b341e2ae340748e2541" ON "posts" ("categoryId") `,
    );
  }

  override down(): void {
    this.addSql(`DROP INDEX "public"."IDX_168bf21b341e2ae340748e2541"`);
  }
}
