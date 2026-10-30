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

  create(dto: CreateCategoryDto): Promise<Category> {
    return this.categoriesRepository.save(
      this.categoriesRepository.create(dto),
    );
  }

  findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({ order: { name: 'ASC' } });
  }

  findOne(id: string): Promise<Category> {
    return this.categoriesRepository.findOneByOrFail({ id });
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
}
