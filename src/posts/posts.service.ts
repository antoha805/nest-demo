import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOptionsWhere, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CategoriesService } from '../categories/categories.service';
import { Comment } from '../comments/comment.entity';
import { CommentsService } from '../comments/comments.service';
import { CursorPaginated } from '../common/cursor-paginated';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate, Paginated } from '../common/paginated';
import { LikeableType } from '../likes/like.entity';
import { LikesService } from '../likes/likes.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostVisibilityService } from './post-visibility.service';
import { Post } from './post.entity';

export type PostWithComments = Post & { comments: CursorPaginated<Comment> };

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly categoriesService: CategoriesService,
    private readonly postVisibilityService: PostVisibilityService,
    private readonly likesService: LikesService,
    private readonly commentsService: CommentsService,
  ) {}

  async create(dto: CreatePostDto, authorId: string): Promise<Post> {
    await this.assertCategoryExists(dto.categoryId);
    const { id } = await this.postsRepository.save(
      this.postsRepository.create({ ...dto, authorId }),
    );
    return this.findOneForUser({ id }, authorId);
  }

  findAll(
    query: PaginationQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<Post>> {
    return paginate(
      this.queryForUser(
        {
          where: this.postVisibilityService.visibleWhere(user),
          // The id keeps pages stable when posts share a timestamp.
          order: { createdAt: 'DESC', id: 'DESC' },
        },
        user?.id,
      ),
      query,
    );
  }

  async findVisibleWithComments(
    id: string,
    user?: AuthenticatedUser,
  ): Promise<PostWithComments> {
    const post = await this.findOneForUser(
      this.postVisibilityService
        .visibleWhere(user)
        .map((where) => ({ ...where, id })),
      user?.id,
    );
    const comments = await this.commentsService.findPageForPost(
      id,
      new CursorPaginationQueryDto(),
      user?.id,
    );
    return { ...post, comments };
  }

  findOne(id: string): Promise<Post> {
    return this.postsRepository.findOneOrFail({
      where: { id },
      relations: { category: true },
    });
  }

  async update(
    id: string,
    dto: UpdatePostDto,
    {
      keepPublished,
      userId,
    }: {
      keepPublished: boolean;
      userId: string;
    },
  ): Promise<Post> {
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }
    const post = await this.postsRepository.preload({
      id,
      ...dto,
      // Otherwise an approved post could be rewritten without review.
      ...(keepPublished ? {} : { published: false }),
    });
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    await this.postsRepository.save(post);
    return this.findOneForUser({ id }, userId);
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.postsRepository.delete(id);
    if (!affected) {
      throw new NotFoundException(`Post ${id} not found`);
    }
  }

  async like(id: string, user: AuthenticatedUser): Promise<void> {
    await this.postVisibilityService.findVisible(id, user);
    await this.likesService.like(LikeableType.POST, id, user.id);
  }

  async unlike(id: string, user: AuthenticatedUser): Promise<void> {
    await this.postVisibilityService.findVisible(id, user);
    await this.likesService.unlike(LikeableType.POST, id, user.id);
  }

  private queryForUser(options: FindManyOptions<Post>, userId?: string) {
    return this.postsRepository
      .createQueryBuilder('post')
      .setFindOptions({ ...options, relations: { category: true } })
      .addSelect(['post.myLikeAt', 'post.myLastCommentAt'])
      .setParameters({
        // Without a user the subqueries match nothing, which gives null.
        myLikeUserId: userId ?? null,
        myLastCommentUserId: userId ?? null,
      });
  }

  private findOneForUser(
    where: FindOptionsWhere<Post> | FindOptionsWhere<Post>[],
    userId?: string,
  ): Promise<Post> {
    return this.queryForUser({ where }, userId).getOneOrFail();
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    if (!(await this.categoriesService.exists(categoryId))) {
      throw new BadRequestException(`Category ${categoryId} does not exist`);
    }
  }
}
