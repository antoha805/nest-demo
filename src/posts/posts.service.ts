import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
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

  async create(dto: CreatePostDto): Promise<Post> {
    await this.assertCategoryExists(dto.categoryId);
    const { id } = await this.postsRepository.save(
      this.postsRepository.create(dto),
    );
    return this.findOne(id);
  }

  findAll(): Promise<Post[]> {
    return this.postsRepository.find({
      relations: { category: true },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string): Promise<Post> {
    return this.postsRepository.findOneOrFail({
      where: { id },
      relations: { category: true },
    });
  }

  async update(id: string, dto: UpdatePostDto): Promise<Post> {
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }
    const post = await this.postsRepository.preload({ id, ...dto });
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

  private async assertCategoryExists(categoryId: string): Promise<void> {
    if (!(await this.categoriesService.exists(categoryId))) {
      throw new BadRequestException(`Category ${categoryId} does not exist`);
    }
  }
}
