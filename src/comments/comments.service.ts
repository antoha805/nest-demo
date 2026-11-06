import { raw } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { cursorPaginate, CursorPaginated } from '../common/cursor-paginated';
import { definedFields } from '../common/defined-fields';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto';
import { LikeableType } from '../likes/like.entity';
import { LikesService } from '../likes/likes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PostVisibilityService } from '../posts/post-visibility.service';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PostCommentedNotification } from './notifications/post-commented.notification';

@Injectable()
export class CommentsService {
  constructor(
    private readonly em: EntityManager,
    private readonly postVisibilityService: PostVisibilityService,
    private readonly likesService: LikesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    postId: string,
    dto: CreateCommentDto,
    user: AuthenticatedUser,
  ): Promise<Comment> {
    const post = await this.postVisibilityService.findVisible(postId, user);
    const comment = this.em.create(Comment, {
      content: dto.content,
      postId,
      author: user.id,
    });
    await this.em.flush();
    // Not for their own comments, nor once the author has been deleted.
    if (post.authorId && post.authorId !== user.id) {
      await this.notificationsService.send(
        post.authorId,
        new PostCommentedNotification(post, comment, user),
      );
    }
    return this.findOneForUser(comment.id, user.id);
  }

  async findAllForPost(
    postId: string,
    query: CursorPaginationQueryDto,
    user?: AuthenticatedUser,
  ): Promise<CursorPaginated<Comment>> {
    await this.postVisibilityService.findVisible(postId, user);
    return this.findPageForPost(postId, query, user?.id);
  }

  // The caller has to check that the user can read the post.
  async findPageForPost(
    postId: string,
    query: CursorPaginationQueryDto,
    userId?: string,
  ): Promise<CursorPaginated<Comment>> {
    const page = await cursorPaginate(
      ({ before, limit }) =>
        this.em.find(
          Comment,
          { postId, ...(before ? { id: { $lt: before } } : {}) },
          { populate: ['author'], orderBy: { id: 'desc' }, limit },
        ),
      query,
    );
    await this.setMyLikeAt(page.data, userId);
    return page;
  }

  // A comment is only as visible as its post, so drafts do not leak through it.
  async findVisible(id: string, user: AuthenticatedUser): Promise<Comment> {
    const comment = await this.em.findOneOrFail(Comment, id);
    await this.postVisibilityService.findVisible(comment.postId, user);
    return comment;
  }

  async update(
    id: string,
    dto: UpdateCommentDto,
    userId: string,
  ): Promise<Comment> {
    const comment = await this.em.findOne(Comment, id);
    if (!comment) {
      throw new NotFoundException(`Comment ${id} not found`);
    }
    Object.assign(comment, definedFields(dto));
    await this.em.flush();
    return this.findOneForUser(id, userId);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.em.nativeDelete(Comment, { id }))) {
      throw new NotFoundException(`Comment ${id} not found`);
    }
  }

  async like(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findVisible(id, user);
    await this.likesService.like(LikeableType.COMMENT, id, user.id);
  }

  async unlike(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findVisible(id, user);
    await this.likesService.unlike(LikeableType.COMMENT, id, user.id);
  }

  // When the user last commented on each of these posts, by post id.
  async lastCommentedAt(
    postIds: string[],
    userId?: string,
  ): Promise<Map<string, Date>> {
    if (!userId || !postIds.length) {
      return new Map();
    }
    const rows = await this.em
      .createQueryBuilder(Comment)
      .select(['postId', raw('MAX("createdAt") AS "lastAt"')])
      .where({ author: userId, postId: { $in: postIds } })
      .groupBy('postId')
      .execute<{ postId: string; lastAt: Date }[]>('all', false);
    return new Map(rows.map((row) => [row.postId, row.lastAt]));
  }

  private async findOneForUser(id: string, userId: string): Promise<Comment> {
    // Refreshed, so the counts include changes made in this request.
    const comment = await this.em.findOneOrFail(Comment, id, {
      populate: ['author'],
      refresh: true,
    });
    await this.setMyLikeAt([comment], userId);
    return comment;
  }

  private async setMyLikeAt(comments: Comment[], userId?: string) {
    const likedAt = await this.likesService.likedAt(
      LikeableType.COMMENT,
      comments.map((comment) => comment.id),
      userId,
    );
    for (const comment of comments) {
      comment.myLikeAt = likedAt.get(comment.id) ?? null;
    }
  }
}
