import { Migration } from '@mikro-orm/migrations';

export class AddPostAuthor1793480324637 extends Migration {
  override name = 'AddPostAuthor1793480324637';

  override up(): void {
    this.addSql(`ALTER TABLE "posts" ADD "authorId" uuid`);
    this.addSql(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  override down(): void {
    this.addSql(
      `ALTER TABLE "posts" DROP CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e"`,
    );
    this.addSql(`ALTER TABLE "posts" DROP COLUMN "authorId"`);
  }
}
