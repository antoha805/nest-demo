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
import { Post } from '../posts/post.entity';
import { User } from '../users/user.entity';

@Entity('comments')
// Serves the cursor pagination of a post's comments.
@Index(['postId', 'id'])
export class Comment {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'uuid' })
  postId: string;

  @ManyToOne(() => Post, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  // Null after the author is deleted.
  @Column({ type: 'uuid', nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: User | null;

  @VirtualColumn({
    type: 'int',
    query: (alias) =>
      `SELECT COUNT(*)::int FROM "likes" WHERE "likes"."likeableType" = 'comment' AND "likes"."likeableId" = ${alias}."id"`,
  })
  likesCount: number;

  // Only loaded by CommentsService.queryForUser, which sets the parameter.
  @VirtualColumn({
    type: 'timestamptz',
    select: false,
    query: (alias) =>
      `SELECT "likes"."createdAt" FROM "likes" WHERE "likes"."likeableType" = 'comment' AND "likes"."likeableId" = ${alias}."id" AND "likes"."userId" = :myLikeUserId`,
  })
  myLikeAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
