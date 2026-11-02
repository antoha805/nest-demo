import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    const { id } = await this.categoriesRepository.save(
      this.categoriesRepository.create(dto),
    );
    return this.findOne(id);
  }

  findAll(): Promise<Category[]> {
    return this.query()
      .setFindOptions({ order: { name: 'ASC' } })
      .getMany();
  }

  findOne(id: string): Promise<Category> {
    return this.query().setFindOptions({ where: { id } }).getOneOrFail();
  }

  exists(id: string): Promise<boolean> {
    return this.categoriesRepository.existsBy({ id });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    return this.categoriesRepository.save(
      this.categoriesRepository.merge(category, dto),
    );
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.categoriesRepository.delete(id);
    if (!affected) {
      throw new NotFoundException(`Category ${id} not found`);
    }
  }

  private query() {
    return this.categoriesRepository
      .createQueryBuilder('category')
      .addSelect('category.postsCount');
  }
}
