import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
  VirtualColumn,
} from 'typeorm';
import { Post } from '../posts/post.entity';

@Entity('categories')
export class Category {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => Post, (post) => post.category)
  posts: Post[];

  // Published only, as categories are public and drafts must stay hidden.
  // Only loaded by CategoriesService.query, so posts do not count it per row.
  @VirtualColumn({
    type: 'int',
    select: false,
    query: (alias) =>
      `SELECT COUNT(*)::int FROM "posts" WHERE "posts"."categoryId" = ${alias}."id" AND "posts"."published"`,
  })
  postsCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
