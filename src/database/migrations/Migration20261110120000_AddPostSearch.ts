import { Migration } from '@mikro-orm/migrations';

export class Migration20261110120000_AddPostSearch extends Migration {
  override name = 'Migration20261110120000_AddPostSearch';

  override up(): void {
    this.addSql(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);
    // Posts are in any language, so words are not stemmed, only lowercased and
    // stripped of accents: "Café" matches "cafe". Only the words with
    // non-ASCII letters, with or without digits, can have accents.
    this.addSql(
      `CREATE TEXT SEARCH CONFIGURATION "simple_unaccent" (COPY = "simple")`,
    );
    this.addSql(
      `ALTER TEXT SEARCH CONFIGURATION "simple_unaccent" ALTER MAPPING FOR "word", "hword", "hword_part", "numword", "numhword", "hword_numpart" WITH "unaccent", "simple"`,
    );
    // Weighted so that a match in the title ranks above one in the content.
    this.addSql(
      `ALTER TABLE "posts" ADD "searchVector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple_unaccent', "title"), 'A') || setweight(to_tsvector('simple_unaccent', "content"), 'B')) STORED`,
    );
    this.addSql(
      `CREATE INDEX "posts_search_vector_index" ON "posts" USING gin ("searchVector")`,
    );
  }

  override down(): void {
    this.addSql(`ALTER TABLE "posts" DROP COLUMN "searchVector"`);
    this.addSql(`DROP TEXT SEARCH CONFIGURATION "simple_unaccent"`);
    this.addSql(`DROP EXTENSION IF EXISTS "unaccent"`);
  }
}
