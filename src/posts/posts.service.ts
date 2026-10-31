import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post } from './post.entity';

export interface PostVisibility {
  includeDrafts: boolean;
  draftsByAuthorId?: string;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(dto: CreatePostDto, authorId: string): Promise<Post> {
    await this.assertCategoryExists(dto.categoryId);
    const { id } = await this.postsRepository.save(
      this.postsRepository.create({ ...dto, authorId }),
    );
    return this.findOne(id);
  }

  findAll(visibility: PostVisibility): Promise<Post[]> {
    return this.postsRepository.find({
      where: this.visibleWhere(visibility),
      relations: { category: true },
      order: { createdAt: 'DESC' },
    });
  }

  findVisible(id: string, visibility: PostVisibility): Promise<Post> {
    return this.postsRepository.findOneOrFail({
      where: this.visibleWhere(visibility).map((where) => ({ ...where, id })),
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
    { keepPublished }: { keepPublished: boolean },
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
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.postsRepository.delete(id);
    if (!affected) {
      throw new NotFoundException(`Post ${id} not found`);
    }
  }

  private visibleWhere({
    includeDrafts,
    draftsByAuthorId,
  }: PostVisibility): FindOptionsWhere<Post>[] {
    if (includeDrafts) {
      return [{}];
    }
    return draftsByAuthorId
      ? [{ published: true }, { authorId: draftsByAuthorId }]
      : [{ published: true }];
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    if (!(await this.categoriesService.exists(categoryId))) {
      throw new BadRequestException(`Category ${categoryId} does not exist`);
    }
  }
}
