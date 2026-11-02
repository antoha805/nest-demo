import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { CategoriesService } from '../categories/categories.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginated, Paginated, paginationOptions } from '../common/paginated';
import { LikeableType } from '../likes/like.entity';
import { LikesService } from '../likes/likes.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post } from './post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly categoriesService: CategoriesService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly likesService: LikesService,
  ) {}

  async create(dto: CreatePostDto, authorId: string): Promise<Post> {
    await this.assertCategoryExists(dto.categoryId);
    const { id } = await this.postsRepository.save(
      this.postsRepository.create({ ...dto, authorId }),
    );
    return this.withLikedByMeAt(await this.findOne(id), authorId);
  }

  async findAll(
    query: PaginationQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<Post>> {
    const [posts, total] = await this.postsRepository.findAndCount({
      where: this.visibleWhere(user),
      relations: { category: true },
      // The id keeps pages stable when posts share a timestamp.
      order: { createdAt: 'DESC', id: 'DESC' },
      ...paginationOptions(query),
    });
    await this.likesService.withLikedByMeAt(LikeableType.POST, posts, user?.id);
    return paginated(posts, total, query);
  }

  async findVisibleForUser(
    id: string,
    user?: AuthenticatedUser,
  ): Promise<Post> {
    return this.withLikedByMeAt(await this.findVisible(id, user), user?.id);
  }

  findVisible(id: string, user?: AuthenticatedUser): Promise<Post> {
    return this.postsRepository.findOneOrFail({
      where: this.visibleWhere(user).map((where) => ({ ...where, id })),
      relations: { category: true },
    });
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
    return this.withLikedByMeAt(await this.findOne(id), userId);
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.postsRepository.delete(id);
    if (!affected) {
      throw new NotFoundException(`Post ${id} not found`);
    }
  }

  async like(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findVisible(id, user);
    await this.likesService.like(LikeableType.POST, id, user.id);
  }

  async unlike(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findVisible(id, user);
    await this.likesService.unlike(LikeableType.POST, id, user.id);
  }

  private async withLikedByMeAt(post: Post, userId?: string): Promise<Post> {
    const [result] = await this.likesService.withLikedByMeAt(
      LikeableType.POST,
      [post],
      userId,
    );
    return result;
  }

  private visibleWhere(user?: AuthenticatedUser): FindOptionsWhere<Post>[] {
    if (!user) {
      return [{ published: true }];
    }
    // Publishers have to see drafts in order to review them.
    return this.caslAbilityFactory.createForUser(user).can('publish', Post)
      ? [{}]
      : [{ published: true }, { authorId: user.id }];
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    if (!(await this.categoriesService.exists(categoryId))) {
      throw new BadRequestException(`Category ${categoryId} does not exist`);
    }
  }
}
