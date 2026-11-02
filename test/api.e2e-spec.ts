import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/auth/auth.service';
import { Category } from './../src/categories/category.entity';
import { Comment } from './../src/comments/comment.entity';
import { CursorPaginated } from './../src/common/cursor-paginated';
import { Paginated } from './../src/common/paginated';
import { Like } from './../src/likes/like.entity';
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
    const { id, name, postsCount } = await createCategory();
    expect(postsCount).toBe(0);

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

  it('counts the published posts of a category', async () => {
    const { id, name } = await createCategory();
    const body = { title: 'T', content: 'C', categoryId: id };
    const count = async () => {
      const [single, list] = await Promise.all([
        anonymous().get(`/api/categories/${id}`).expect(200),
        anonymous().get('/api/categories').expect(200),
      ]);
      const listed = (list.body as Category[]).find((c) => c.name === name);
      expect(listed?.postsCount).toBe((single.body as Category).postsCount);
      return (single.body as Category).postsCount;
    };

    await expect(count()).resolves.toBe(0);

    const draft = await http().post('/api/posts').send(body).expect(201);
    const { id: postId } = draft.body as Post;
    await expect(count()).resolves.toBe(0);
    expect((draft.body as Post).category).not.toHaveProperty('postsCount');

    await http()
      .patch(`/api/posts/${postId}`)
      .send({ published: true })
      .expect(200);
    await expect(count()).resolves.toBe(1);

    const updated = await http()
      .patch(`/api/categories/${id}`)
      .send({ description: 'updated' })
      .expect(200);
    expect(updated.body).toMatchObject({ postsCount: 1 });

    await http().delete(`/api/posts/${postId}`).expect(204);
    await expect(count()).resolves.toBe(0);
    await http().delete(`/api/categories/${id}`).expect(204);
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
        roles: ['member'],
        permissions: [
          PERMISSIONS.COMMENTS_CREATE,
          PERMISSIONS.COMMENTS_DELETE_OWN,
          PERMISSIONS.COMMENTS_UPDATE_OWN,
          PERMISSIONS.LIKES_CREATE,
          PERMISSIONS.LIKES_DELETE,
          PERMISSIONS.POSTS_CREATE,
          PERMISSIONS.POSTS_DELETE_OWN,
          PERMISSIONS.POSTS_UPDATE_OWN,
        ],
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

    it('records the author of a post', async () => {
      const { token } = await register();
      const { id: authorId } = await currentUser(token);
      await http()
        .put(`/api/users/${authorId}/roles`)
        .send({ roles: ['editor'] })
        .expect(200);
      const category = await createCategory();
      const body = {
        title: 'T',
        content: 'C',
        published: true,
        categoryId: category.id,
      };

      await withToken(token)
        .post('/api/posts')
        .send({ ...body, authorId: randomUUID() })
        .expect(400);

      const created = await withToken(token)
        .post('/api/posts')
        .send(body)
        .expect(201);
      const post = created.body as Post;
      expect(post.authorId).toBe(authorId);

      await http()
        .patch(`/api/posts/${post.id}`)
        .send({ authorId: randomUUID() })
        .expect(400);
      const edited = await http()
        .patch(`/api/posts/${post.id}`)
        .send({ title: 'Edited' })
        .expect(200);
      expect((edited.body as Post).authorId).toBe(authorId);

      const fetched = await anonymous()
        .get(`/api/posts/${post.id}`)
        .expect(200);
      expect(fetched.body).not.toHaveProperty('author');

      await http().delete(`/api/users/${authorId}`).expect(204);
      const orphaned = await anonymous()
        .get(`/api/posts/${post.id}`)
        .expect(200);
      expect((orphaned.body as Post).authorId).toBeNull();

      await http().delete(`/api/posts/${post.id}`).expect(204);
      await http().delete(`/api/categories/${category.id}`).expect(204);
    });

    it('limits members to their own posts and drafts', async () => {
      const { token } = await register();
      const { token: otherToken } = await register();
      const category = await createCategory();
      const body = { title: 'T', content: 'C', categoryId: category.id };

      await withToken(token)
        .post('/api/posts')
        .send({ ...body, published: true })
        .expect(403);
      const created = await withToken(token)
        .post('/api/posts')
        .send(body)
        .expect(201);
      const { id } = created.body as Post;
      const url = `/api/posts/${id}`;
      const isListed = async (client: ReturnType<typeof anonymous>) => {
        const response = await client.get('/api/posts').expect(200);
        return (response.body as Paginated<Post>).data.some(
          (post) => post.id === id,
        );
      };

      await anonymous().get(url).expect(404);
      await withToken(otherToken).get(url).expect(404);
      await withToken(token).get(url).expect(200);
      await http().get(url).expect(200);
      await withToken('not-a-token').get(url).expect(404);
      await expect(isListed(anonymous())).resolves.toBe(false);
      await expect(isListed(withToken(otherToken))).resolves.toBe(false);
      await expect(isListed(withToken(token))).resolves.toBe(true);

      await withToken(token)
        .patch('/api/posts/not-a-uuid')
        .send({ title: 'X' })
        .expect(400);
      await withToken(token).delete('/api/posts/not-a-uuid').expect(400);
      await withToken(token).delete(`/api/posts/${randomUUID()}`).expect(404);
      await anonymous().delete(url).expect(401);

      await withToken(otherToken).patch(url).send({ title: 'X' }).expect(403);
      await withToken(otherToken).delete(url).expect(403);
      await withToken(token).patch(url).send({ published: true }).expect(403);
      await withToken(token).patch(url).send({ title: 'Mine' }).expect(200);

      await http().patch(url).send({ published: true }).expect(200);
      await anonymous().get(url).expect(200);
      await expect(isListed(anonymous())).resolves.toBe(true);

      const edited = await withToken(token)
        .patch(url)
        .send({ content: 'Rewritten' })
        .expect(200);
      expect((edited.body as Post).published).toBe(false);
      await anonymous().get(url).expect(404);

      await withToken(token).delete(url).expect(204);
      await http().delete(`/api/categories/${category.id}`).expect(204);
    });

    describe('comments and likes', () => {
      const createPost = async (token: string, published = false) => {
        const category = await createCategory();
        const created = await withToken(token)
          .post('/api/posts')
          .send({
            title: 'T',
            content: 'C',
            categoryId: category.id,
            published,
          })
          .expect(201);
        return created.body as Post;
      };

      const createComment = async (token: string, postId: string) => {
        const created = await withToken(token)
          .post(`/api/posts/${postId}/comments`)
          .send({ content: 'Nice' })
          .expect(201);
        return created.body as Comment;
      };

      const countLikes = (likeableId: string) =>
        app.get(DataSource).manager.countBy(Like, { likeableId });

      it('lets members manage their own comments', async () => {
        const { token } = await register();
        const { token: otherToken } = await register();
        const { id: authorId } = await currentUser(token);
        const post = await createPost(adminToken, true);
        const url = `/api/posts/${post.id}/comments`;

        await anonymous().post(url).send({ content: 'Nice' }).expect(401);
        await withToken(token).post(url).send({ content: '' }).expect(400);
        await withToken(token)
          .post(url)
          .send({ content: 'Nice', authorId: randomUUID() })
          .expect(400);
        await withToken(token)
          .post(`/api/posts/${randomUUID()}/comments`)
          .send({ content: 'Nice' })
          .expect(404);

        const comment = await createComment(token, post.id);
        expect(comment).toMatchObject({
          content: 'Nice',
          postId: post.id,
          authorId,
          likesCount: 0,
        });

        const listed = await anonymous().get(url).expect(200);
        expect(
          (listed.body as CursorPaginated<Comment>).data.map((c) => c.id),
        ).toEqual([comment.id]);

        const commentUrl = `/api/comments/${comment.id}`;
        await anonymous().patch(commentUrl).send({ content: 'X' }).expect(401);
        await withToken(otherToken)
          .patch(commentUrl)
          .send({ content: 'X' })
          .expect(403);
        await withToken(otherToken).delete(commentUrl).expect(403);
        await http().patch(commentUrl).send({ content: 'X' }).expect(403);

        const edited = await withToken(token)
          .patch(commentUrl)
          .send({ content: 'Edited' })
          .expect(200);
        expect(edited.body).toMatchObject({ content: 'Edited', authorId });

        await withToken(token).delete(commentUrl).expect(204);
        await withToken(token).delete(commentUrl).expect(404);
        await withToken(token).delete('/api/comments/not-a-uuid').expect(400);
      });

      it('lets moderators delete any comment', async () => {
        const { token } = await register();
        const post = await createPost(adminToken, true);
        const comment = await createComment(token, post.id);

        await http().delete(`/api/comments/${comment.id}`).expect(204);
      });

      it('requires the permissions', async () => {
        const { token } = await register();
        const { id } = await currentUser(token);
        const post = await createPost(adminToken, true);
        const comment = await createComment(adminToken, post.id);
        await http()
          .put(`/api/users/${id}/roles`)
          .send({ roles: [] })
          .expect(200);

        await withToken(token)
          .post(`/api/posts/${post.id}/comments`)
          .send({ content: 'Nice' })
          .expect(403);
        await withToken(token).put(`/api/posts/${post.id}/like`).expect(403);
        await withToken(token).delete(`/api/posts/${post.id}/like`).expect(403);
        await withToken(token)
          .put(`/api/comments/${comment.id}/like`)
          .expect(403);
      });

      it('counts one like per user on posts and comments', async () => {
        const { token } = await register();
        const { token: otherToken } = await register();
        const post = await createPost(adminToken, true);
        const comment = await createComment(token, post.id);
        const postUrl = `/api/posts/${post.id}`;
        const commentsUrl = `${postUrl}/comments`;
        const postLikes = async () => {
          const response = await anonymous().get(postUrl).expect(200);
          return (response.body as Post).likesCount;
        };
        const commentLikes = async () => {
          const response = await anonymous().get(commentsUrl).expect(200);
          return (response.body as CursorPaginated<Comment>).data[0].likesCount;
        };

        await anonymous().put(`${postUrl}/like`).expect(401);
        await expect(postLikes()).resolves.toBe(0);

        await withToken(token).put(`${postUrl}/like`).expect(204);
        await withToken(token).put(`${postUrl}/like`).expect(204);
        await withToken(otherToken).put(`${postUrl}/like`).expect(204);
        await expect(postLikes()).resolves.toBe(2);
        await expect(commentLikes()).resolves.toBe(0);

        await withToken(token)
          .put(`/api/comments/${comment.id}/like`)
          .expect(204);
        await expect(commentLikes()).resolves.toBe(1);
        await expect(postLikes()).resolves.toBe(2);

        await withToken(token).delete(`${postUrl}/like`).expect(204);
        await withToken(token).delete(`${postUrl}/like`).expect(204);
        await expect(postLikes()).resolves.toBe(1);

        await withToken(token)
          .put(`/api/posts/${randomUUID()}/like`)
          .expect(404);
        await withToken(token)
          .put(`/api/comments/${randomUUID()}/like`)
          .expect(404);
        await withToken(token).put('/api/posts/not-a-uuid/like').expect(400);
      });

      it('hides comments and likes of posts the user cannot read', async () => {
        const { token: authorToken } = await register();
        const { token: otherToken } = await register();
        const post = await createPost(adminToken, true);
        const comment = await createComment(authorToken, post.id);
        const draft = await createPost(authorToken);
        const postUrl = `/api/posts/${draft.id}`;

        await anonymous().get(`${postUrl}/comments`).expect(404);
        await withToken(otherToken).get(`${postUrl}/comments`).expect(404);
        await withToken(otherToken)
          .post(`${postUrl}/comments`)
          .send({ content: 'Nice' })
          .expect(404);
        await withToken(otherToken).put(`${postUrl}/like`).expect(404);

        await createComment(authorToken, draft.id);
        await withToken(authorToken).put(`${postUrl}/like`).expect(204);
        await withToken(authorToken).get(`${postUrl}/comments`).expect(200);

        await http()
          .patch(`/api/posts/${post.id}`)
          .send({ published: false })
          .expect(200);
        const commentUrl = `/api/comments/${comment.id}`;
        await withToken(otherToken).put(`${commentUrl}/like`).expect(404);
        await withToken(otherToken).delete(commentUrl).expect(404);
        await withToken(authorToken)
          .patch(commentUrl)
          .send({ content: 'X' })
          .expect(404);
      });

      it('deletes likes along with what they point to', async () => {
        const { token } = await register();
        const { id: userId } = await currentUser(token);
        const post = await createPost(adminToken, true);
        const other = await createPost(adminToken, true);
        const kept = await createComment(adminToken, other.id);
        const removed = await createComment(adminToken, other.id);
        const cascaded = await createComment(adminToken, post.id);

        await withToken(token).put(`/api/posts/${post.id}/like`).expect(204);
        await withToken(token).put(`/api/comments/${kept.id}/like`).expect(204);
        await withToken(token)
          .put(`/api/comments/${removed.id}/like`)
          .expect(204);
        await withToken(token)
          .put(`/api/comments/${cascaded.id}/like`)
          .expect(204);

        await http().delete(`/api/comments/${removed.id}`).expect(204);
        await expect(countLikes(removed.id)).resolves.toBe(0);
        await expect(countLikes(kept.id)).resolves.toBe(1);

        await http().delete(`/api/posts/${post.id}`).expect(204);
        await expect(countLikes(post.id)).resolves.toBe(0);
        await expect(countLikes(cascaded.id)).resolves.toBe(0);
        await expect(countLikes(kept.id)).resolves.toBe(1);

        await http().delete(`/api/users/${userId}`).expect(204);
        await expect(countLikes(kept.id)).resolves.toBe(0);
      });

      it('paginates posts and comments', async () => {
        const post = await createPost(adminToken, true);
        const url = `/api/posts/${post.id}/comments`;
        const ids: string[] = [];
        for (let i = 0; i < 3; i++) {
          ids.push((await createComment(adminToken, post.id)).id);
        }
        const page = async (query: string) => {
          const response = await anonymous()
            .get(url + query)
            .expect(200);
          return response.body as CursorPaginated<Comment>;
        };

        const first = await page('?limit=2');
        expect(first.limit).toBe(2);
        expect(first.nextCursor).toBe(ids[1]);
        expect(first.data.map((c) => c.id)).toEqual([ids[2], ids[1]]);

        // Deleting a comment that was already read must not skip the next one.
        await http().delete(`/api/comments/${ids[2]}`).expect(204);

        const second = await page(`?limit=2&after=${first.nextCursor}`);
        expect(second.nextCursor).toBeNull();
        expect(second.data.map((c) => c.id)).toEqual([ids[0]]);

        const beyond = await page(`?after=${ids[0]}`);
        expect(beyond).toEqual({ data: [], limit: 20, nextCursor: null });

        const posts = await anonymous().get('/api/posts?limit=1').expect(200);
        const { data, limit, total } = posts.body as Paginated<Post>;
        expect(data).toHaveLength(1);
        expect(limit).toBe(1);
        expect(total).toBeGreaterThan(1);
        expect(data[0].category).toBeDefined();

        for (const query of ['limit=0', 'limit=101', 'limit=x', 'unknown=1']) {
          await anonymous().get(`/api/posts?${query}`).expect(400);
          await anonymous().get(`${url}?${query}`).expect(400);
        }
        for (const query of ['page=0', 'page=1.5', 'page=1e300']) {
          await anonymous().get(`/api/posts?${query}`).expect(400);
        }
        await anonymous().get(`${url}?page=1`).expect(400);
        await anonymous().get(`${url}?after=not-a-uuid`).expect(400);
      });

      it('includes the first page of comments in a single post', async () => {
        const { token } = await register();
        const { token: otherToken } = await register();
        const post = await createPost(adminToken, true);
        const url = `/api/posts/${post.id}`;
        const ids: string[] = [];
        for (let i = 0; i < 21; i++) {
          ids.push((await createComment(token, post.id)).id);
        }
        await withToken(token).put(`/api/comments/${ids[20]}/like`).expect(204);

        const fetched = await withToken(token).get(url).expect(200);
        const { comments, commentsCount } = fetched.body as Post & {
          comments: CursorPaginated<Comment>;
        };
        expect(commentsCount).toBe(21);
        expect(comments.limit).toBe(20);
        expect(comments.nextCursor).toBe(ids[1]);
        expect(comments.data.map((c) => c.id)).toEqual(ids.slice(1).reverse());
        expect(comments.data[0]).toMatchObject({ likesCount: 1 });
        expect(comments.data[0].myLikeAt).not.toBeNull();
        expect(comments.data[1].myLikeAt).toBeNull();

        const next = await anonymous()
          .get(`${url}/comments?after=${comments.nextCursor}`)
          .expect(200);
        expect(next.body).toMatchObject({
          data: [{ id: ids[0], myLikeAt: null }],
          nextCursor: null,
        });

        const asAnonymous = await anonymous().get(url).expect(200);
        const anonymousComments = (
          asAnonymous.body as { comments: CursorPaginated<Comment> }
        ).comments;
        expect(anonymousComments.data[0].myLikeAt).toBeNull();

        const list = await anonymous().get('/api/posts?limit=1').expect(200);
        expect((list.body as Paginated<Post>).data[0]).not.toHaveProperty(
          'comments',
        );
        const edited = await http()
          .patch(url)
          .send({ title: 'Edited' })
          .expect(200);
        expect(edited.body).not.toHaveProperty('comments');

        const draft = await createPost(token);
        await createComment(token, draft.id);
        await withToken(otherToken).get(`/api/posts/${draft.id}`).expect(404);
        const ownDraft = await withToken(token)
          .get(`/api/posts/${draft.id}`)
          .expect(200);
        expect(
          (ownDraft.body as { comments: CursorPaginated<Comment> }).comments
            .data,
        ).toHaveLength(1);
      });

      it('tells each user when they liked something', async () => {
        const { token } = await register();
        const { token: otherToken } = await register();
        const post = await createPost(adminToken, true);
        const comment = await createComment(adminToken, post.id);
        const postUrl = `/api/posts/${post.id}`;
        const commentUrl = `/api/comments/${comment.id}`;

        expect(post.myLikeAt).toBeNull();
        expect(comment.myLikeAt).toBeNull();

        const likedAt = async (client: ReturnType<typeof anonymous>) => {
          const [single, posts, comments] = await Promise.all([
            client.get(postUrl).expect(200),
            client.get('/api/posts?limit=100').expect(200),
            client.get(`${postUrl}/comments`).expect(200),
          ]);
          const listed = (posts.body as Paginated<Post>).data.find(
            ({ id }) => id === post.id,
          );
          return {
            post: (single.body as Post).myLikeAt,
            listedPost: listed?.myLikeAt,
            listedComment: (comments.body as CursorPaginated<Comment>).data[0]
              .myLikeAt,
          };
        };
        const notLiked = { post: null, listedPost: null, listedComment: null };

        await expect(likedAt(withToken(token))).resolves.toEqual(notLiked);

        await withToken(token).put(`${postUrl}/like`).expect(204);
        await withToken(token).put(`${commentUrl}/like`).expect(204);

        const liked = await likedAt(withToken(token));
        expect(
          new Date(liked.post as unknown as string).getTime(),
        ).not.toBeNaN();
        expect(liked.listedPost).toBe(liked.post);
        expect(typeof liked.listedComment).toBe('string');

        await expect(likedAt(withToken(otherToken))).resolves.toEqual(notLiked);
        await expect(likedAt(anonymous())).resolves.toEqual(notLiked);

        await withToken(token).put(`${postUrl}/like`).expect(204);
        await expect(likedAt(withToken(token))).resolves.toEqual(liked);

        const edited = await http()
          .patch(postUrl)
          .send({ title: 'Edited' })
          .expect(200);
        expect(edited.body).toMatchObject({ likesCount: 1, myLikeAt: null });

        await withToken(token).delete(`${postUrl}/like`).expect(204);
        await withToken(token).delete(`${commentUrl}/like`).expect(204);
        await expect(likedAt(withToken(token))).resolves.toEqual(notLiked);
      });

      it('tells each user when they last commented on a post', async () => {
        const { token } = await register();
        const { token: otherToken } = await register();
        const post = await createPost(adminToken, true);
        const url = `/api/posts/${post.id}`;
        expect(post).toMatchObject({ commentsCount: 0, myLastCommentAt: null });

        const stats = async (client: ReturnType<typeof anonymous>) => {
          const [single, list] = await Promise.all([
            client.get(url).expect(200),
            client.get('/api/posts?limit=100').expect(200),
          ]);
          const listed = (list.body as Paginated<Post>).data.find(
            ({ id }) => id === post.id,
          );
          expect(listed?.commentsCount).toBe(
            (single.body as Post).commentsCount,
          );
          expect(listed?.myLastCommentAt).toBe(
            (single.body as Post).myLastCommentAt,
          );
          return single.body as Post;
        };

        const first = await createComment(token, post.id);
        const second = await createComment(token, post.id);
        await createComment(adminToken, post.id);

        const mine = await stats(withToken(token));
        expect(mine.commentsCount).toBe(3);
        expect(new Date(mine.myLastCommentAt as Date)).toEqual(
          new Date(second.createdAt),
        );
        await expect(stats(withToken(otherToken))).resolves.toMatchObject({
          commentsCount: 3,
          myLastCommentAt: null,
        });
        await expect(stats(anonymous())).resolves.toMatchObject({
          commentsCount: 3,
          myLastCommentAt: null,
        });

        const edited = await http()
          .patch(url)
          .send({ title: 'Edited' })
          .expect(200);
        expect(edited.body).toMatchObject({ commentsCount: 3 });
        expect((edited.body as Post).myLastCommentAt).not.toBeNull();

        await withToken(token).delete(`/api/comments/${first.id}`).expect(204);
        await withToken(token).delete(`/api/comments/${second.id}`).expect(204);
        await expect(stats(withToken(token))).resolves.toMatchObject({
          commentsCount: 1,
          myLastCommentAt: null,
        });
      });

      it('keeps comments of deleted users', async () => {
        const { token } = await register();
        const { id: userId } = await currentUser(token);
        const post = await createPost(adminToken, true);
        const comment = await createComment(token, post.id);

        await http().delete(`/api/users/${userId}`).expect(204);

        const listed = await anonymous()
          .get(`/api/posts/${post.id}/comments`)
          .expect(200);
        expect((listed.body as CursorPaginated<Comment>).data).toMatchObject([
          { id: comment.id, authorId: null },
        ]);
      });
    });

    it('protects the member role', async () => {
      const roles = await http().get('/api/roles').expect(200);
      const member = (roles.body as Role[]).find((r) => r.name === 'member');

      await http()
        .patch(`/api/roles/${member?.id}`)
        .send({ name: uniqueName() })
        .expect(409);
      await http().delete(`/api/roles/${member?.id}`).expect(409);
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
