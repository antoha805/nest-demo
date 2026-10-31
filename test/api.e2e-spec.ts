import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/auth/auth.service';
import { Category } from './../src/categories/category.entity';
import { Post } from './../src/posts/post.entity';
import {
  ADMIN_ROLE,
  PERMISSION_NAMES,
  PERMISSIONS,
} from './../src/roles/permission-names';
import { Role } from './../src/roles/role.entity';
import { User } from './../src/users/user.entity';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  let adminToken: string;

  const anonymous = () => request(app.getHttpServer());
  const http = () => withToken(adminToken);
  const withToken = (token: string) =>
    request.agent(app.getHttpServer()).set('Authorization', `Bearer ${token}`);
  const uniqueName = () => `e2e-${randomUUID()}`;
  const password = 'correct horse battery';

  // Skips the controller, as tests create more users than its rate limit allows.
  const register = async () => {
    const email = `${uniqueName()}@example.com`;
    const { accessToken } = await app
      .get(AuthService)
      .register({ email, password });
    return { email, token: accessToken };
  };

  const currentUser = async (token: string) => {
    const response = await withToken(token).get('/api/auth/me').expect(200);
    return response.body as {
      id: string;
      email: string;
      roles: string[];
      permissions: string[];
    };
  };

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

    const { token } = await register();
    const { id } = await currentUser(token);
    const dataSource = app.get(DataSource);
    const admin = await dataSource.manager.findOneByOrFail(Role, {
      name: ADMIN_ROLE,
    });
    await dataSource
      .createQueryBuilder()
      .relation(User, 'roles')
      .of(id)
      .add(admin.id);
    adminToken = token;
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

    const notFound = await http().get(`/api/posts/${missingId}`).expect(404);
    expect(notFound.body).toEqual({
      statusCode: 404,
      message: 'The requested record was not found',
      error: 'Not Found',
    });

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

    await http()
      .patch(`/api/categories/${missingId}`)
      .send({ description: 'updated' })
      .expect(404);

    const category = await createCategory();
    await http()
      .patch(`/api/categories/${category.id}`)
      .send({ name: null })
      .expect(400);
    await http().delete(`/api/categories/${category.id}`).expect(204);
  });

  describe('authentication', () => {
    it('registers and logs in with normalised emails', async () => {
      const email = `${uniqueName()}@example.com`;
      const registered = await anonymous()
        .post('/api/auth/register')
        .send({ email, password })
        .expect(201);
      const { accessToken: token } = registered.body as { accessToken: string };

      await expect(currentUser(token)).resolves.toMatchObject({
        email,
        roles: [],
        permissions: [],
      });

      const login = await anonymous()
        .post('/api/auth/login')
        .send({ email: email.toUpperCase(), password })
        .expect(200);
      const { accessToken } = login.body as { accessToken: string };
      await currentUser(accessToken);

      await anonymous()
        .post('/api/auth/register')
        .send({ email, password })
        .expect(409);
    });

    it('rejects bad credentials the same way', async () => {
      const { email } = await register();

      const wrongPassword = await anonymous()
        .post('/api/auth/login')
        .send({ email, password: 'wrong password' })
        .expect(401);
      const unknownEmail = await anonymous()
        .post('/api/auth/login')
        .send({ email: `${uniqueName()}@example.com`, password })
        .expect(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });

    it('rejects passwords bcrypt cannot fully hash', async () => {
      await anonymous()
        .post('/api/auth/register')
        .send({
          email: `${uniqueName()}@example.com`,
          password: 'x'.repeat(73),
        })
        .expect(400);
    });

    it('rejects missing, invalid and orphaned tokens', async () => {
      await anonymous().get('/api/auth/me').expect(401);
      await withToken('not-a-token').get('/api/auth/me').expect(401);

      const { token } = await register();
      const { id } = await currentUser(token);
      await http().delete(`/api/users/${id}`).expect(204);
      await withToken(token).get('/api/auth/me').expect(401);
    });

    it('never returns password hashes', async () => {
      const { token } = await register();
      const { id } = await currentUser(token);

      const user = await http().get(`/api/users/${id}`).expect(200);
      const users = await http().get('/api/users').expect(200);

      expect(JSON.stringify([user.body, users.body])).not.toContain(
        'passwordHash',
      );
    });
  });

  describe('authorization', () => {
    it('keeps reads public and writes protected', async () => {
      await anonymous().get('/api/categories').expect(200);
      await anonymous().get('/api/posts').expect(200);
      await anonymous()
        .post('/api/categories')
        .send({ name: uniqueName() })
        .expect(401);

      const { token } = await register();
      await withToken(token)
        .post('/api/categories')
        .send({ name: uniqueName() })
        .expect(403);
      await withToken(token).get('/api/users').expect(403);
      await withToken(token).get('/api/roles').expect(403);
    });

    it('stores a permission for every name in the code', async () => {
      const response = await http().get('/api/permissions').expect(200);
      const names = (response.body as { name: string }[]).map((p) => p.name);

      expect(names).toEqual([...PERMISSION_NAMES].sort());
    });

    it('applies role changes to tokens already issued', async () => {
      const { token } = await register();
      const { id } = await currentUser(token);

      const assigned = await http()
        .put(`/api/users/${id}/roles`)
        .send({ roles: ['editor'] })
        .expect(200);
      expect(assigned.body).toMatchObject({ roles: [{ name: 'editor' }] });

      const created = await withToken(token)
        .post('/api/categories')
        .send({ name: uniqueName() })
        .expect(201);
      await withToken(token).get('/api/users').expect(403);

      await http()
        .put(`/api/users/${id}/roles`)
        .send({ roles: [] })
        .expect(200);
      await withToken(token)
        .delete(`/api/categories/${(created.body as Category).id}`)
        .expect(403);
      await http()
        .delete(`/api/categories/${(created.body as Category).id}`)
        .expect(204);
    });

    it('combines direct permissions with those from roles', async () => {
      const { token } = await register();
      const { id } = await currentUser(token);

      await http()
        .put(`/api/users/${id}/permissions`)
        .send({ permissions: [PERMISSIONS.USERS_READ] })
        .expect(200);
      await http()
        .put(`/api/users/${id}/roles`)
        .send({ roles: ['editor'] })
        .expect(200);

      const { permissions, roles } = await currentUser(token);
      expect(roles).toEqual(['editor']);
      expect(permissions).toContain(PERMISSIONS.USERS_READ);
      expect(permissions).toContain(PERMISSIONS.POSTS_CREATE);
      await withToken(token).get('/api/users').expect(200);
    });

    it('rejects unknown roles and permissions', async () => {
      const { token } = await register();
      const { id } = await currentUser(token);

      await http()
        .put(`/api/users/${id}/roles`)
        .send({ roles: ['nope'] })
        .expect(400);
      await http()
        .put(`/api/users/${id}/permissions`)
        .send({ permissions: ['nope'] })
        .expect(400);
      await http()
        .post('/api/roles')
        .send({ name: uniqueName(), permissions: ['nope'] })
        .expect(400);
      await http()
        .put(`/api/users/${randomUUID()}/roles`)
        .send({ roles: [] })
        .expect(404);
    });

    it('supports the role CRUD lifecycle', async () => {
      const { token } = await register();
      const { id: userId } = await currentUser(token);
      const name = uniqueName();

      const created = await http()
        .post('/api/roles')
        .send({ name, permissions: [PERMISSIONS.ROLES_READ] })
        .expect(201);
      const { id } = created.body as Role;
      await http()
        .post('/api/roles')
        .send({ name, permissions: [] })
        .expect(409);

      await http()
        .put(`/api/users/${userId}/roles`)
        .send({ roles: [name] })
        .expect(200);
      await withToken(token).get('/api/roles').expect(200);
      await withToken(token).get('/api/users').expect(403);

      const updated = await http()
        .patch(`/api/roles/${id}`)
        .send({ permissions: [PERMISSIONS.USERS_READ] })
        .expect(200);
      expect(updated.body).toMatchObject({
        name,
        permissions: [{ name: PERMISSIONS.USERS_READ }],
      });
      await withToken(token).get('/api/users').expect(200);

      await http().delete(`/api/roles/${id}`).expect(204);
      await http().get(`/api/roles/${id}`).expect(404);
      await withToken(token).get('/api/users').expect(403);
    });

    it('protects the admin role', async () => {
      const roles = await http().get('/api/roles').expect(200);
      const admin = (roles.body as Role[]).find((r) => r.name === ADMIN_ROLE);

      expect(admin?.permissions.map((p) => p.name).sort()).toEqual(
        [...PERMISSION_NAMES].sort(),
      );
      await http()
        .patch(`/api/roles/${admin?.id}`)
        .send({ permissions: [] })
        .expect(409);
      await http().delete(`/api/roles/${admin?.id}`).expect(409);
    });
  });

  it('throttles repeated logins', async () => {
    const attempt = () =>
      anonymous()
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong password' });

    let response = await attempt();
    while (response.status === 401) {
      response = await attempt();
    }

    expect(response.status).toBe(429);
  }, 30_000);
});
