import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Formula,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Trigger,
} from '@mikro-orm/decorators/legacy';
import { Category } from '../categories/category.entity';
import { User } from '../users/user.entity';

@Entity({ tableName: 'posts' })
// Deletes the likes, as they cannot have a foreign key. Created by a migration,
// and declared here so the schema diff does not drop it.
@Trigger({
  name: 'posts_delete_likes',
  timing: 'after',
  events: ['delete'],
  expression: `CREATE TRIGGER "posts_delete_likes" AFTER DELETE ON "posts" FOR EACH ROW EXECUTE FUNCTION "delete_likes"('post')`,
})
export class Post {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: Opt<string>;

  @Property({ type: 'varchar', length: 200 })
  title!: string;

  @Property({ type: 'text' })
  content!: string;

  @Property({ type: 'boolean', default: false })
  published: Opt<boolean> = false;

  @Index()
  @ManyToOne(() => Category, {
    fieldName: 'categoryId',
    deleteRule: 'restrict',
    updateRule: 'no action',
  })
  category!: Category;

  @Property({ type: 'uuid', persist: false })
  get categoryId(): Opt<string> {
    return this.category.id;
  }

  // Null for posts from before authors, and after the author is deleted.
  // Mapped to the id alone, as no route returns the author.
  @ManyToOne(() => User, {
    fieldName: 'authorId',
    mapToPk: true,
    nullable: true,
    deleteRule: 'set null',
    updateRule: 'no action',
  })
  authorId: string | null = null;

  @Formula(
    (cols) =>
      `(SELECT COUNT(*)::int FROM "likes" WHERE "likes"."likeableType" = 'post' AND "likes"."likeableId" = ${cols.id})`,
    { type: 'integer' },
  )
  likesCount!: Opt<number>;

  @Formula(
    (cols) =>
      `(SELECT COUNT(*)::int FROM "comments" WHERE "comments"."postId" = ${cols.id})`,
    { type: 'integer' },
  )
  commentsCount!: Opt<number>;

  // Set by PostsService for the user making the request, so null without one.
  @Property({ type: 'datetime', persist: false })
  myLikeAt?: Date | null;

  // When the user last commented. Also set by PostsService.
  @Property({ type: 'datetime', persist: false })
  myLastCommentAt?: Date | null;

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
