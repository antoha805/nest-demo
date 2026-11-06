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
import { Post } from '../posts/post.entity';
import { toPublicUser } from '../users/public-user';
import { User } from '../users/user.entity';

@Entity({ tableName: 'comments' })
// Deletes the likes, as they cannot have a foreign key. Created by a migration,
// and declared here so the schema diff does not drop it.
@Trigger({
  name: 'comments_delete_likes',
  timing: 'after',
  events: ['delete'],
  expression: `CREATE TRIGGER "comments_delete_likes" AFTER DELETE ON "comments" FOR EACH ROW EXECUTE FUNCTION "delete_likes"('comment')`,
})
// Serves the cursor pagination of a post's comments.
@Index({ properties: ['postId', 'id'] })
export class Comment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: Opt<string>;

  @Property({ type: 'text' })
  content!: string;

  @ManyToOne(() => Post, {
    fieldName: 'postId',
    mapToPk: true,
    deleteRule: 'cascade',
    updateRule: 'no action',
  })
  postId!: string;

  // Null after the author is deleted. CommentsService populates it, and only
  // its public fields are shown, so the email stays private.
  @ManyToOne(() => User, {
    fieldName: 'authorId',
    nullable: true,
    deleteRule: 'set null',
    updateRule: 'no action',
    serializer: (author?: User | null) =>
      author ? toPublicUser(author) : null,
  })
  author: User | null = null;

  @Property({ type: 'uuid', persist: false })
  get authorId(): Opt<string> | null {
    return this.author?.id ?? null;
  }

  // Lazy, so loading a comment to check or change it does not count them:
  // CommentsService populates it for its responses.
  @Formula(
    (cols) =>
      `(SELECT COUNT(*)::int FROM "likes" WHERE "likes"."likeableType" = 'comment' AND "likes"."likeableId" = ${cols.id})`,
    { type: 'integer', lazy: true },
  )
  likesCount?: Opt<number>;

  // Set by CommentsService for the user making the request, so null without one.
  @Property({ type: 'datetime', persist: false })
  myLikeAt?: Date | null;

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
