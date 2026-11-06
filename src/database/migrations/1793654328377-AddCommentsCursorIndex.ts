import { Migration } from '@mikro-orm/migrations';

export class AddCommentsCursorIndex1793654328377 extends Migration {
  override name = 'AddCommentsCursorIndex1793654328377';

  override up(): void {
    this.addSql(`DROP INDEX "public"."IDX_e44ddaaa6d058cb4092f83ad61"`);
    this.addSql(
      `CREATE INDEX "IDX_9fedf58adcfb0eaac5d470ba6c" ON "comments" ("postId", "id") `,
    );
  }

  override down(): void {
    this.addSql(`DROP INDEX "public"."IDX_9fedf58adcfb0eaac5d470ba6c"`);
    this.addSql(
      `CREATE INDEX "IDX_e44ddaaa6d058cb4092f83ad61" ON "comments" ("postId") `,
    );
  }
}
