import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Category } from './../src/categories/category.entity';
import { Post } from './../src/posts/post.entity';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  const http = () => request(app.getHttpServer());
  const uniqueName = () => `e2e-${randomUUID()}`;

  const createCategory = async (): Promise<Category> => {
    const response = await http()
      .post('/api/categories')
      .send({ name: uniqueName() })
      .expect(201);
    return response.body as Category;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves resources only under /api', async () => {
    await http().get('/categories').expect(404);
    await http().get('/posts').expect(404);
    await http().get('/api/categories').expect(200);
    await http().get('/api/posts').expect(200);
  });

  it('supports the category CRUD lifecycle', async () => {
    const { id, name } = await createCategory();

    await http().post('/api/categories').send({ name }).expect(409);

    const updated = await http()
      .patch(`/api/categories/${id}`)
      .send({ description: 'updated' })
      .expect(200);
    expect(updated.body).toMatchObject({ name, description: 'updated' });

    const fetched = await http().get(`/api/categories/${id}`).expect(200);
    expect(fetched.body).toMatchObject({ description: 'updated' });

    await http().delete(`/api/categories/${id}`).expect(204);
    await http().get(`/api/categories/${id}`).expect(404);
    await http().delete(`/api/categories/${id}`).expect(404);
  });

  it('supports the post CRUD lifecycle and protects used categories', async () => {
    const first = await createCategory();
    const second = await createCategory();

    const created = await http()
      .post('/api/posts')
      .send({ title: 'Title', content: 'Content', categoryId: first.id })
      .expect(201);
    const post = created.body as Post;
    expect(post.published).toBe(false);
    expect(post.category.id).toBe(first.id);

    await http().delete(`/api/categories/${first.id}`).expect(409);

    const updated = await http()
      .patch(`/api/posts/${post.id}`)
      .send({ title: 'New title', published: true, categoryId: second.id })
      .expect(200);
    expect(updated.body).toMatchObject({
      title: 'New title',
      content: 'Content',
      published: true,
      categoryId: second.id,
      category: { id: second.id },
    });

    const untouched = await http()
      .patch(`/api/posts/${post.id}`)
      .send({})
      .expect(200);
    expect(untouched.body).toMatchObject({ title: 'New title' });

    await http().delete(`/api/posts/${post.id}`).expect(204);
    await http().get(`/api/posts/${post.id}`).expect(404);

    await http().delete(`/api/categories/${first.id}`).expect(204);
    await http().delete(`/api/categories/${second.id}`).expect(204);
  });

  it('rejects invalid input', async () => {
    const missingId = randomUUID();

    await http().get('/api/posts/not-a-uuid').expect(400);
    await http().post('/api/categories').send({}).expect(400);
    await http()
      .post('/api/categories')
      .send({ name: uniqueName(), unknown: true })
      .expect(400);
    await http()
      .post('/api/posts')
      .send({ title: 'T', content: 'C', categoryId: missingId })
      .expect(400);
    await http()
      .patch(`/api/posts/${missingId}`)
      .send({ title: 'T' })
      .expect(404);

    const category = await createCategory();
    await http()
      .patch(`/api/categories/${category.id}`)
      .send({ name: null })
      .expect(400);
    await http().delete(`/api/categories/${category.id}`).expect(204);
  });
});
