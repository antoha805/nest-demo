import { EntityDTO, FilterQuery, wrap } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CategoriesService } from '../categories/categories.service';
import { Category } from '../categories/category.entity';
import { Comment } from '../comments/comment.entity';
import { CommentsService } from '../comments/comments.service';
import { CursorPaginated } from '../common/cursor-paginated';
import { definedFields } from '../common/defined-fields';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate, Paginated } from '../common/paginated';
import { LikeableType } from '../likes/like.entity';
import { LikesService } from '../likes/likes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostLikedNotification } from './notifications/post-liked.notification';
import { PostVisibilityService } from './post-visibility.service';
import { Post } from './post.entity';

// What post responses show, beyond the post: the counts are lazy formulas.
const RESPONSE_POPULATE = ['category', 'likesCount', 'commentsCount'] as const;

export type PostWithComments = EntityDTO<Post> & {
  comments: CursorPaginated<Comment>;
};

@Injectable()
export class PostsService {
  constructor(
    private readonly em: EntityManager,
    private readonly categoriesService: CategoriesService,
    private readonly postVisibilityService: PostVisibilityService,
    private readonly likesService: LikesService,
    private readonly commentsService: CommentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    { categoryId, ...dto }: CreatePostDto,
    authorId: string,
  ): Promise<Post> {
    await this.assertCategoryExists(categoryId);
    const post = this.em.create(Post, {
      title: dto.title,
      content: dto.content,
      published: dto.published ?? false,
      category: categoryId,
      authorId,
    });
    await this.em.flush();
    return this.findOneForUser({ id: post.id }, authorId);
  }

  async findAll(
    query: PaginationQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<Post>> {
    const page = await paginate(
      ({ limit, offset }) =>
        this.em.findAndCount(
          Post,
          this.postVisibilityService.visibleWhere(user),
          {
            populate: RESPONSE_POPULATE,
            // The id keeps pages stable when posts share a timestamp.
            orderBy: { createdAt: 'desc', id: 'desc' },
            limit,
            offset,
          },
        ),
      query,
    );
    await this.setMyActivity(page.data, user?.id);
    return page;
  }

  async findVisibleWithComments(
    id: string,
    user?: AuthenticatedUser,
  ): Promise<PostWithComments> {
    const post = await this.findOneForUser(
      { ...this.postVisibilityService.visibleWhere(user), id },
      user?.id,
    );
    const comments = await this.commentsService.findPageForPost(
      id,
      new CursorPaginationQueryDto(),
      user?.id,
    );
    return { ...wrap(post).toObject(), comments };
  }

  findOne(id: string): Promise<Post> {
    return this.em.findOneOrFail(Post, id, { populate: ['category'] });
  }

  async update(
    id: string,
    { categoryId, ...dto }: UpdatePostDto,
    {
      keepPublished,
      userId,
    }: {
      keepPublished: boolean;
      userId: string;
    },
  ): Promise<Post> {
    if (categoryId) {
      await this.assertCategoryExists(categoryId);
    }
    const post = await this.em.findOne(Post, id);
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    Object.assign(post, definedFields(dto));
    if (categoryId) {
      post.category = this.em.getReference(Category, categoryId);
    }
    // Otherwise an approved post could be rewritten without review.
    if (!keepPublished) {
      post.published = false;
    }
    await this.em.flush();
    return this.findOneForUser({ id }, userId);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.em.nativeDelete(Post, { id }))) {
      throw new NotFoundException(`Post ${id} not found`);
    }
  }

  async like(id: string, user: AuthenticatedUser): Promise<void> {
    const post = await this.postVisibilityService.findVisible(id, user);
    const liked = await this.likesService.like(LikeableType.POST, id, user.id);
    // Only for a new like, not their own posts, nor once the author has been
    // deleted.
    if (liked && post.authorId && post.authorId !== user.id) {
      await this.notificationsService.send(
        post.authorId,
        new PostLikedNotification(post, user),
      );
    }
  }

  async unlike(id: string, user: AuthenticatedUser): Promise<void> {
    await this.postVisibilityService.findVisible(id, user);
    await this.likesService.unlike(LikeableType.POST, id, user.id);
  }

  private async findOneForUser(
    where: FilterQuery<Post>,
    userId?: string,
  ): Promise<Post> {
    // Refreshed, so the counts include changes made in this request.
    const post = await this.em.findOneOrFail(Post, where, {
      populate: RESPONSE_POPULATE,
      refresh: true,
    });
    await this.setMyActivity([post], userId);
    return post;
  }

  // Without a user both stay null.
  private async setMyActivity(posts: Post[], userId?: string): Promise<void> {
    const ids = posts.map((post) => post.id);
    const likedAt = await this.likesService.likedAt(
      LikeableType.POST,
      ids,
      userId,
    );
    const commentedAt = await this.commentsService.lastCommentedAt(ids, userId);
    for (const post of posts) {
      post.myLikeAt = likedAt.get(post.id) ?? null;
      post.myLastCommentAt = commentedAt.get(post.id) ?? null;
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    if (!(await this.categoriesService.exists(categoryId))) {
      throw new BadRequestException(`Category ${categoryId} does not exist`);
    }
  }
}
