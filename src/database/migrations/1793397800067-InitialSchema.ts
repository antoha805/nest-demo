import { Migration } from '@mikro-orm/migrations';

export class InitialSchema1793397800067 extends Migration {
  override name = 'InitialSchema1793397800067';

  override async up(): Promise<void> {
    // Databases created by the former `synchronize: true` already have this schema.
    const [{ exists }] = await this.execute(
      `SELECT to_regclass('"categories"') IS NOT NULL AS "exists"`,
    );
    if (exists) {
      this.addSql(`ALTER TABLE "posts" ALTER COLUMN "id" SET DEFAULT uuidv7()`);
      this.addSql(
        `ALTER TABLE "categories" ALTER COLUMN "id" SET DEFAULT uuidv7()`,
      );
      return;
    }

    this.addSql(
      `CREATE TABLE "posts" ("id" uuid NOT NULL DEFAULT uuidv7(), "title" character varying(200) NOT NULL, "content" text NOT NULL, "published" boolean NOT NULL DEFAULT false, "categoryId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id"))`,
    );
    this.addSql(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuidv7(), "name" character varying(100) NOT NULL, "description" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    this.addSql(
      `ALTER TABLE "posts" ADD CONSTRAINT "FK_168bf21b341e2ae340748e2541d" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  override down(): void {
    this.addSql(
      `ALTER TABLE "posts" DROP CONSTRAINT "FK_168bf21b341e2ae340748e2541d"`,
    );
    this.addSql(`DROP TABLE "categories"`);
    this.addSql(`DROP TABLE "posts"`);
  }
}
