import {
  EntityDTO,
  FilterQuery,
  ObjectQuery,
  QueryOrderMap,
  raw,
  wrap,
} from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { CategoriesService } from '../categories/categories.service';
import { Category } from '../categories/category.entity';
import { Comment } from '../comments/comment.entity';
import { CommentsService } from '../comments/comments.service';
import { CursorPaginated } from '../common/cursor-paginated';
import { definedFields } from '../common/defined-fields';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto';
import { paginate, Paginated } from '../common/paginated';
import { LikeableType } from '../likes/like.entity';
import { LikesService } from '../likes/likes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationQueue } from '../notifications/queue/notification-queue';
import { CreatePostDto } from './dto/create-post.dto';
import { FindPostsQueryDto } from './dto/find-posts-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostLikedNotification } from './notifications/post-liked.notification';
import { PostPublishedNotification } from './notifications/post-published.notification';
import { PostVisibilityService } from './post-visibility.service';
import { Post } from './post.entity';

// What post responses show, beyond the post: the counts are lazy formulas.
const RESPONSE_POPULATE = ['category', 'likesCount', 'commentsCount'] as const;

// The posts that match a search, the best matches first: the title weighs
// more than the content, and long contents do not win by their length alone.
function searchFor(q: string): {
  where: ObjectQuery<Post>;
  orderBy: QueryOrderMap<Post>;
} {
  const query = `websearch_to_tsquery('simple_unaccent', ?)`;
  return {
    where: {
      [raw((alias) => `${alias}."searchVector" @@ ${query}`, [q])]: [],
    },
    orderBy: {
      [raw((alias) => `ts_rank_cd(${alias}."searchVector", ${query}, 1)`, [q])]:
        'desc',
    },
  };
}

// What PostsService.can checks, beyond the permissions that apply to every post.
export type PostAction = 'update' | 'delete' | 'publish';

export type PostWithComments = EntityDTO<Post> & {
  comments: CursorPaginated<Comment>;
};

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly categoriesService: CategoriesService,
    private readonly postVisibilityService: PostVisibilityService,
    private readonly likesService: LikesService,
    private readonly commentsService: CommentsService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationQueue: NotificationQueue,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  // Whether the user can do this to the post, for the permissions that depend
  // on it, such as .own ones. Used by PostAccess and the MCP tools alike.
  async can(
    action: PostAction,
    id: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    const post = await this.findOne(id);
    return this.caslAbilityFactory.createForUser(user).can(action, post);
  }

  // For publishing through `published` when creating or editing a post.
  assertCanPublish(
    { published }: { published?: boolean },
    user: AuthenticatedUser,
  ): void {
    if (
      published &&
      !this.caslAbilityFactory.createForUser(user).can('publish', Post)
    ) {
      throw new ForbiddenException('You cannot publish posts');
    }
  }

  async create(
    { categoryId, published, ...dto }: CreatePostDto,
    authorId: string,
  ): Promise<Post> {
    await this.assertCategoryExists(categoryId);
    const post = this.em.create(Post, {
      ...dto,
      category: categoryId,
      authorId,
    });
    await this.em.flush();
    if (published) {
      await this.publishOnce(post);
    }
    return this.findOneForUser({ id: post.id }, authorId);
  }

  async findAll(
    query: FindPostsQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<Post>> {
    const visible = this.postVisibilityService.visibleWhere(user);
    const { where, orderBy } = query.q
      ? searchFor(query.q)
      : { where: {}, orderBy: {} };
    const page = await paginate(
      ({ limit, offset }) =>
        this.em.findAndCount(
          Post,
          { $and: [visible, where] },
          {
            populate: RESPONSE_POPULATE,
            // The id keeps pages stable when posts share a timestamp.
            orderBy: [orderBy, { createdAt: 'desc', id: 'desc' }],
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
    { categoryId, published, ...dto }: UpdatePostDto,
    userId: string,
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
    await this.em.flush();
    if (published) {
      await this.publishOnce(post);
    }
    return this.findOneForUser({ id }, userId);
  }

  // Idempotent: publishing a published post does nothing.
  async publish(id: string): Promise<void> {
    await this.publishOnce(await this.findOne(id));
  }

  // Publishing is final. The update only matches a draft, so of concurrent
  // requests only one publishes the post and announces it.
  private async publishOnce(post: Post): Promise<void> {
    const published = await this.em.nativeUpdate(
      Post,
      { id: post.id, publishedAt: null },
      { publishedAt: new Date() },
    );
    if (published) {
      await this.announce(post);
    }
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

  // Tells every other user about a newly published post. Queued, so the
  // request does not wait for it, and a failure is logged rather than failing
  // the request, which has saved the post.
  private async announce(post: Post): Promise<void> {
    try {
      await this.notificationQueue.sendToAllUsers(
        PostPublishedNotification.queued(post.id),
        {
          except: post.authorId ? [post.authorId] : [],
          jobId: `post-published-${post.id}`,
        },
      );
    } catch (error: unknown) {
      this.logger.error(
        { err: error, postId: post.id },
        'Failed to queue the announcement of a post',
      );
    }
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
