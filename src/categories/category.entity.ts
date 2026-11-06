import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Formula,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'categories' })
export class Category {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: Opt<string>;

  @Property({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description: string | null = null;

  // Published only, as categories are public and drafts must stay hidden.
  // Lazy, so posts do not count it per row: CategoriesService populates it.
  @Formula(
    (cols) =>
      `(SELECT COUNT(*)::int FROM "posts" WHERE "posts"."categoryId" = ${cols.id} AND "posts"."published")`,
    { type: 'integer', lazy: true },
  )
  postsCount?: number;

  @Property({
    type: 'datetime',
    columnType: 'timestamptz',
    defaultRaw: 'now()',
  })
  createdAt: Opt<Date> = new Date();

  @Property({
    type: 'datetime',
    columnType: 'timestamptz',
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
