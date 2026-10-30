import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Category } from '../categories/category.entity';
import { Post } from '../posts/post.entity';

const categories = [
  { name: 'Technology', description: 'Software, hardware and the web' },
  { name: 'Travel', description: 'Places worth visiting' },
  { name: 'Food', description: 'Recipes and restaurants' },
];

const posts = [
  {
    title: 'Getting started with NestJS',
    content: 'NestJS brings modules and dependency injection to Node.js.',
    published: true,
    category: 'Technology',
  },
  {
    title: 'Why PostgreSQL is a solid default',
    content: 'Reliable transactions, rich data types and great tooling.',
    published: true,
    category: 'Technology',
  },
  {
    title: 'A weekend in Lisbon',
    content: 'Trams, viewpoints and plenty of custard tarts.',
    published: true,
    category: 'Travel',
  },
  {
    title: 'Packing light for long trips',
    content: 'Draft notes on what to bring and what to leave at home.',
    published: false,
    category: 'Travel',
  },
  {
    title: 'The perfect tomato soup',
    content: 'Roast the tomatoes first and finish with fresh basil.',
    published: true,
    category: 'Food',
  },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);

    await dataSource.transaction(async (manager) => {
      await manager.upsert(Category, categories, ['name']);
      const savedCategories = await manager.find(Category);
      const categoryIds = new Map(savedCategories.map((c) => [c.name, c.id]));

      let created = 0;
      for (const { category, ...post } of posts) {
        if (!(await manager.existsBy(Post, { title: post.title }))) {
          const categoryId = categoryIds.get(category);
          await manager.insert(Post, { ...post, categoryId });
          created++;
        }
      }

      console.log(
        `Upserted ${categories.length} categories, created ${created} posts`,
      );
    });
  } finally {
    await app.close();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
