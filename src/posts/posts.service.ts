import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOptionsWhere, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { CategoriesService } from '../categories/categories.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate, Paginated } from '../common/paginated';
import { LikeableType } from '../likes/like.entity';
import { LikesService } from '../likes/likes.service';
import { selectMyLikeAt } from '../likes/select-my-like-at';
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
    return this.findOneForUser({ id }, authorId);
  }

  findAll(
    query: PaginationQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<Post>> {
    return paginate(
      this.queryForUser(
        {
          where: this.visibleWhere(user),
          // The id keeps pages stable when posts share a timestamp.
          order: { createdAt: 'DESC', id: 'DESC' },
        },
        user?.id,
      ),
      query,
    );
  }

  findVisibleForUser(id: string, user?: AuthenticatedUser): Promise<Post> {
    return this.findOneForUser(
      this.visibleWhere(user).map((where) => ({ ...where, id })),
      user?.id,
    );
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
    return this.findOneForUser({ id }, userId);
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

  private queryForUser(options: FindManyOptions<Post>, userId?: string) {
    return selectMyLikeAt(
      this.postsRepository
        .createQueryBuilder('post')
        .setFindOptions({ ...options, relations: { category: true } })
        .addSelect('post.myLastCommentAt')
        .setParameter('myLastCommentUserId', userId ?? null),
      userId,
    );
  }

  private findOneForUser(
    where: FindOptionsWhere<Post> | FindOptionsWhere<Post>[],
    userId?: string,
  ): Promise<Post> {
    return this.queryForUser({ where }, userId).getOneOrFail();
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
