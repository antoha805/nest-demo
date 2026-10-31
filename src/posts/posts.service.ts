import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CategoriesService } from '../categories/categories.service';
import { PERMISSIONS, PermissionName } from '../roles/permission-names';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post } from './post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(dto: CreatePostDto, user: AuthenticatedUser): Promise<Post> {
    if (dto.published && !this.canPublish(user)) {
      throw new ForbiddenException('You cannot publish posts');
    }
    await this.assertCategoryExists(dto.categoryId);
    const { id } = await this.postsRepository.save(
      this.postsRepository.create({ ...dto, authorId: user.id }),
    );
    return this.findById(id);
  }

  findAll(user?: AuthenticatedUser): Promise<Post[]> {
    return this.postsRepository.find({
      where: this.visibleTo(user),
      relations: { category: true },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string, user?: AuthenticatedUser): Promise<Post> {
    return this.postsRepository.findOneOrFail({
      where: this.visibleTo(user).map((visible) => ({ ...visible, id })),
      relations: { category: true },
    });
  }

  async update(
    id: string,
    dto: UpdatePostDto,
    user: AuthenticatedUser,
  ): Promise<Post> {
    const post = await this.postsRepository.findOneBy({ id });
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    this.assertCanChange(
      post,
      user,
      PERMISSIONS.POSTS_UPDATE_ALL,
      PERMISSIONS.POSTS_UPDATE_OWN,
    );
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const changes = { ...dto };
    if (!this.canPublish(user)) {
      if (dto.published) {
        throw new ForbiddenException('You cannot publish posts');
      }
      // Otherwise an approved post could be rewritten without review.
      changes.published = false;
    }

    await this.postsRepository.save(this.postsRepository.merge(post, changes));
    return this.findById(id);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const post = await this.postsRepository.findOneBy({ id });
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    this.assertCanChange(
      post,
      user,
      PERMISSIONS.POSTS_DELETE_ALL,
      PERMISSIONS.POSTS_DELETE_OWN,
    );
    await this.postsRepository.delete(id);
  }

  private findById(id: string): Promise<Post> {
    return this.postsRepository.findOneOrFail({
      where: { id },
      relations: { category: true },
    });
  }

  private canPublish(user: AuthenticatedUser): boolean {
    return user.permissions.includes(PERMISSIONS.POSTS_PUBLISH);
  }

  private visibleTo(user?: AuthenticatedUser): FindOptionsWhere<Post>[] {
    if (!user) {
      return [{ published: true }];
    }
    // Publishers have to see drafts in order to review them.
    return this.canPublish(user)
      ? [{}]
      : [{ published: true }, { authorId: user.id }];
  }

  private assertCanChange(
    post: Post,
    user: AuthenticatedUser,
    all: PermissionName,
    own: PermissionName,
  ): void {
    const isOwn = post.authorId === user.id;
    if (
      !user.permissions.includes(all) &&
      !(isOwn && user.permissions.includes(own))
    ) {
      throw new ForbiddenException();
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    if (!(await this.categoriesService.exists(categoryId))) {
      throw new BadRequestException(`Category ${categoryId} does not exist`);
    }
  }
}
