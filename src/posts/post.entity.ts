import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
  VirtualColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity';
import { User } from '../users/user.entity';

@Entity('posts')
export class Post {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'boolean', default: false })
  published: boolean;

  @Index()
  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, (category) => category.posts, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  // Null for posts from before authors, and after the author is deleted.
  @Column({ type: 'uuid', nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: User | null;

  @VirtualColumn({
    type: 'int',
    query: (alias) =>
      `SELECT COUNT(*)::int FROM "likes" WHERE "likes"."likeableType" = 'post' AND "likes"."likeableId" = ${alias}."id"`,
  })
  likesCount: number;

  // Only loaded by PostsService.queryForUser, which sets the parameter.
  @VirtualColumn({
    type: 'timestamptz',
    select: false,
    query: (alias) =>
      `SELECT "likes"."createdAt" FROM "likes" WHERE "likes"."likeableType" = 'post' AND "likes"."likeableId" = ${alias}."id" AND "likes"."userId" = :myLikeUserId`,
  })
  myLikeAt: Date | null;

  @VirtualColumn({
    type: 'int',
    query: (alias) =>
      `SELECT COUNT(*)::int FROM "comments" WHERE "comments"."postId" = ${alias}."id"`,
  })
  commentsCount: number;

  // When the user last commented. Also only loaded by queryForUser.
  @VirtualColumn({
    type: 'timestamptz',
    select: false,
    query: (alias) =>
      `SELECT MAX("comments"."createdAt") FROM "comments" WHERE "comments"."postId" = ${alias}."id" AND "comments"."authorId" = :myLastCommentUserId`,
  })
  myLastCommentAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
