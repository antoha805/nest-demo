import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { definedFields } from '../common/defined-fields';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly em: EntityManager) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    const category = this.em.create(Category, {
      name: dto.name,
      description: dto.description ?? null,
    });
    await this.em.flush();
    return this.findOne(category.id);
  }

  findAll(): Promise<Category[]> {
    return this.em.find(
      Category,
      {},
      { populate: ['postsCount'], orderBy: { name: 'asc' } },
    );
  }

  findOne(id: string): Promise<Category> {
    // Refreshed, so the count includes changes made in this request.
    return this.em.findOneOrFail(Category, id, {
      populate: ['postsCount'],
      refresh: true,
    });
  }

  async exists(id: string): Promise<boolean> {
    return (await this.em.count(Category, { id })) > 0;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    Object.assign(category, definedFields(dto));
    await this.em.flush();
    return category;
  }

  async remove(id: string): Promise<void> {
    if (!(await this.em.nativeDelete(Category, { id }))) {
      throw new NotFoundException(`Category ${id} not found`);
    }
  }
}
