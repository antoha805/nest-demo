import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/auth/auth.service';
import { EmailVerification } from './../src/auth/email-verification.entity';
import { EmailVerificationService } from './../src/auth/email-verification.service';
import { syncPermissions } from './../src/database/sync-permissions';
import { Category } from './../src/categories/category.entity';
import { Comment } from './../src/comments/comment.entity';
import { CursorPaginated } from './../src/common/cursor-paginated';
import { Paginated } from './../src/common/paginated';
import { Like } from './../src/likes/like.entity';
import { DatabaseNotification } from './../src/notifications/database-notification.entity';
import { Mail, Mailer } from './../src/mail/mailer';
import { MailMessage } from './../src/notifications/messages/mail-message';
import {
  MailRecipient,
  Notification as AppNotification,
  NotificationChannelName,
} from './../src/notifications/notification';
import { NotificationBroadcaster } from './../src/notifications/notification-broadcaster';
import { NotificationsService } from './../src/notifications/notifications.service';
import { Post } from './../src/posts/post.entity';
import {
  ADMIN_ROLE,
  PERMISSION_NAMES,
  PERMISSIONS,
} from './../src/roles/permission-names';
import { Permission } from './../src/roles/permission.entity';
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
  const uniqueNickname = () =>
    `e2e_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const password = 'correct horse battery';

  // Each use gets its own identity map, like a request does.
  const em = () => app.get(EntityManager).fork();

  // Skips the controller, as tests create more users than its rate limit allows.
  // Confirmed by default, as most tests need users who can write: registered
  // as with mail off, which confirms them without mailing a code.
  const register = async ({ verified = true } = {}) => {
    const email = `${uniqueName()}@example.com`;
    const nickname = uniqueNickname();
    const mailOff = verified
      ? jest.spyOn(app.get(Mailer), 'enabled', 'get').mockReturnValue(false)
      : null;
    try {
      const { accessToken } = await RequestContext.create(em(), () =>
        app.get(AuthService).register({ email, nickname, password }),
      );
      return { email, nickname, token: accessToken };
    } finally {
      mailOff?.mockRestore();
    }
  };

  const currentUser = async (token: string) => {
    const response = await withToken(token).get('/api/auth/me').expect(200);
    return response.body as {
      id: string;
      email: string;
      nickname: string;
      emailVerifiedAt: string | null;
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
    const manager = em();
    const user = await manager.findOneOrFail(User, id, { populate: ['roles'] });
    user.roles.add(await manager.findOneOrFail(Role, { name: ADMIN_ROLE }));
    await manager.flush();
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

  describe('post search', () => {
    // Letters only, so each is one word no other post contains.
    const uniqueWord = () =>
      randomUUID()
        .replaceAll('-', '')
        .replace(/\d/g, (digit) => 'ghijklmnop'[Number(digit)]);

    let categoryId: string;
    const postIds: string[] = [];

    const createPost = async (
      fields: { title: string; content: string; published?: boolean },
      token = adminToken,
    ) => {
      const response = await withToken(token)
        .post('/api/posts')
        .send({ published: true, ...fields, categoryId })
        .expect(201);
      const { id } = response.body as Post;
      postIds.push(id);
      return id;
    };

    const search = async (
      q: string,
      client: ReturnType<typeof anonymous> = anonymous(),
    ) => {
      const response = await client.get('/api/posts').query({ q }).expect(200);
      return response.body as Paginated<Post>;
    };
    const searchIds = async (
      q: string,
      client?: ReturnType<typeof anonymous>,
    ) => (await search(q, client)).data.map((post) => post.id);

    beforeAll(async () => {
      categoryId = (await createCategory()).id;
    });

    afterAll(async () => {
      for (const id of postIds) {
        await http().delete(`/api/posts/${id}`).expect(204);
      }
      await http().delete(`/api/categories/${categoryId}`).expect(204);
    });

    it('ranks matches in the title above those in the content', async () => {
      const word = uniqueWord();
      // Created first, so the newer posts would come first without the rank.
      const inTitle = await createPost({
        title: `About ${word}`,
        content: 'Nothing else',
      });
      const inContent = await createPost({
        title: 'Something else',
        content: `Mentions ${word} and ${word} again`,
      });
      await createPost({ title: 'Unrelated', content: 'Unrelated' });

      await expect(searchIds(word)).resolves.toEqual([inTitle, inContent]);
      await expect(searchIds(word.toUpperCase())).resolves.toEqual([
        inTitle,
        inContent,
      ]);
      const page = await search(word);
      expect(page).toMatchObject({ total: 2, page: 1, totalPages: 1 });
      expect(page.data[0]).not.toHaveProperty('searchVector');
      expect(page.data[0]).toHaveProperty('likesCount', 0);
    });

    it('matches words whatever their accents and language', async () => {
      const word = uniqueWord();
      const accented = await createPost({
        title: `Crème ${word}`,
        content: 'Привет, мир',
      });
      const plain = await createPost({
        title: `Creme ${word}`,
        content: 'Other words',
      });

      for (const q of [`creme ${word}`, `CRÈME ${word}`]) {
        expect((await searchIds(q)).sort()).toEqual([accented, plain].sort());
      }
      await expect(searchIds(`${word} мир`)).resolves.toEqual([accented]);
      await expect(searchIds(`${word} -мир`)).resolves.toEqual([plain]);
      await expect(searchIds(`"${word} creme"`)).resolves.toEqual([]);
    });

    it('finds only the posts the user can see', async () => {
      const word = uniqueWord();
      const draft = await createPost({
        title: word,
        content: 'Draft',
        published: false,
      });
      const { token } = await register();

      await expect(searchIds(word)).resolves.toEqual([]);
      await expect(searchIds(word, withToken(token))).resolves.toEqual([]);
      await expect(searchIds(word, http())).resolves.toEqual([draft]);

      // Writing the post again is searched by its new title.
      const renamed = uniqueWord();
      await http()
        .patch(`/api/posts/${draft}`)
        .send({ title: renamed })
        .expect(200);
      await expect(searchIds(word, http())).resolves.toEqual([]);
      await expect(searchIds(renamed, http())).resolves.toEqual([draft]);
    });

    it('lists all posts for a blank search and rejects a long one', async () => {
      const all = await anonymous().get('/api/posts').expect(200);
      const blank = await search('   ');
      expect(blank.total).toBe((all.body as Paginated<Post>).total);
      await expect(searchIds('!!! ---')).resolves.toEqual([]);
      // MikroORM writes the rank's search into the SQL instead of binding it.
      const quotes = `O'${uniqueWord()}'); DROP TABLE "posts"; -- \\`;
      const quoted = await createPost({ title: quotes, content: 'Quotes' });
      await expect(searchIds(quotes)).resolves.toEqual([quoted]);

      await anonymous()
        .get('/api/posts')
        .query({ q: 'a'.repeat(201) })
        .expect(400);
      await anonymous()
        .get('/api/posts')
        .query({ q: ['a', 'b'] })
        .expect(400);
    });
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
    afterEach(() => jest.restoreAllMocks());

    it('registers and logs in with normalised emails', async () => {
      // With mail off, so the user is confirmed and gets their role's permissions.
      jest.spyOn(app.get(Mailer), 'enabled', 'get').mockReturnValue(false);
      const email = `${uniqueName()}@example.com`;
      const nickname = uniqueNickname();
      const registered = await anonymous()
        .post('/api/auth/register')
        .send({ email, nickname, password })
        .expect(201);
      const { accessToken: token } = registered.body as { accessToken: string };

      await expect(currentUser(token)).resolves.toMatchObject({
        email,
        roles: ['member'],
        permissions: [
          PERMISSIONS.COMMENTS_CREATE,
          PERMISSIONS.COMMENTS_DELETE_OWN,
          PERMISSIONS.COMMENTS_LIKE,
          PERMISSIONS.COMMENTS_UPDATE_OWN,
          PERMISSIONS.POSTS_CREATE,
          PERMISSIONS.POSTS_DELETE_OWN,
          PERMISSIONS.POSTS_LIKE,
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
        .send({ email, nickname: uniqueNickname(), password })
        .expect(409);
    });

    it('lets users change their nickname', async () => {
      const { token, email, nickname } = await register();
      const { nickname: taken } = await register();
      const me = (body: object) =>
        withToken(token).patch('/api/auth/me').send(body);
      await expect(currentUser(token)).resolves.toMatchObject({ nickname });

      const changed = uniqueNickname();
      const updated = await me({ nickname: changed.toUpperCase() }).expect(200);
      expect(updated.body).toMatchObject({ email, nickname: changed });
      await expect(currentUser(token)).resolves.toMatchObject({
        nickname: changed,
      });
      await me({ nickname: changed }).expect(200);

      await me({ nickname: taken }).expect(409);
      await me({}).expect(400);
      await me({ nickname: 'ab' }).expect(400);
      await me({ nickname: uniqueNickname(), email: 'x@example.com' }).expect(
        400,
      );
      await anonymous()
        .patch('/api/auth/me')
        .send({ nickname: uniqueNickname() })
        .expect(401);
      await expect(currentUser(token)).resolves.toMatchObject({
        email,
        nickname: changed,
      });
    });

    it('requires a unique, valid nickname', async () => {
      const { nickname } = await register();
      const send = (body: object) =>
        anonymous()
          .post('/api/auth/register')
          .send({ email: `${uniqueName()}@example.com`, password, ...body });

      await send({}).expect(400);
      await send({ nickname: 'ab' }).expect(400);
      await send({ nickname: 'x'.repeat(31) }).expect(400);
      await send({ nickname: 'has space' }).expect(400);
      await send({ nickname }).expect(409);
      // Lowercased, so a different case does not get around the uniqueness.
      await send({ nickname: nickname.toUpperCase() }).expect(409);
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
          nickname: uniqueNickname(),
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

    describe('email verification', () => {
      let mailerSend: jest.SpyInstance;
      beforeEach(() => {
        mailerSend = jest
          .spyOn(app.get(Mailer), 'send')
          .mockResolvedValue(undefined);
      });

      const codesMailedTo = (email: string) =>
        mailerSend.mock.calls
          .map(([mail]) => mail as Mail)
          .filter((mail) => mail.to === email)
          .map((mail) => /\b(\d{6})\b/.exec(mail.subject)![1]);
      const lastCode = (email: string) => codesMailedTo(email).at(-1)!;
      const otherCode = (code: string) =>
        code === '000000' ? '000001' : '000000';

      const verify = (token: string, code: string) =>
        withToken(token).post('/api/auth/verify-email').send({ code });
      const resend = (token: string) =>
        withToken(token).post('/api/auth/verify-email/resend');
      // Skips the controller, whose rate limit all tests share.
      const verifyDirectly = async (token: string, code: string) => {
        const user = await currentUser(token);
        return RequestContext.create(em(), () =>
          app
            .get(EmailVerificationService)
            .verify({ ...user, emailVerifiedAt: null }, code),
        );
      };
      // As if time had passed since the code was sent.
      const backdate = async (
        token: string,
        fields: { sentAt?: Date; expiresAt?: Date },
      ) => {
        const { id } = await currentUser(token);
        await em().nativeUpdate(EmailVerification, { userId: id }, fields);
      };

      it('mails a code on registration, and confirms the email with it', async () => {
        const { token, email } = await register({ verified: false });
        expect(codesMailedTo(email)).toHaveLength(1);
        const [mail] = mailerSend.mock.calls[0] as [Mail];
        expect(mail.text).toContain(
          `Your code to confirm your email is ${lastCode(email)}.`,
        );

        // Unconfirmed users can read and edit their profile, but not write.
        await expect(currentUser(token)).resolves.toMatchObject({
          emailVerifiedAt: null,
          roles: ['member'],
          permissions: [],
        });
        await withToken(token).get('/api/posts').expect(200);
        await withToken(token)
          .patch('/api/auth/me')
          .send({ nickname: uniqueNickname() })
          .expect(200);
        const category = await createCategory();
        await withToken(token)
          .post('/api/posts')
          .send({ title: 'T', content: 'C', categoryId: category.id })
          .expect(403);

        await verify(token, '12345').expect(400);
        await verify(token, lastCode(email)).expect(204);

        const confirmed = await currentUser(token);
        expect(confirmed.emailVerifiedAt).not.toBeNull();
        expect(confirmed.permissions).toContain(PERMISSIONS.POSTS_CREATE);
        await withToken(token)
          .post('/api/posts')
          .send({ title: 'T', content: 'C', categoryId: category.id })
          .expect(201);

        // Confirming again changes nothing, and there is no code to resend.
        await verify(token, lastCode(email)).expect(204);
        await resend(token).expect(409);
        expect(
          await em().count(EmailVerification, { userId: confirmed.id }),
        ).toBe(0);
      });

      it('stops a code after 5 wrong tries', async () => {
        const { token, email } = await register({ verified: false });
        const code = lastCode(email);

        for (let i = 0; i < 5; i++) {
          await expect(verifyDirectly(token, otherCode(code))).rejects.toThrow(
            'The code is wrong',
          );
        }
        await expect(verifyDirectly(token, code)).rejects.toThrow(
          /tried too often/,
        );
        expect((await currentUser(token)).emailVerifiedAt).toBeNull();
      });

      it('expires codes after 15 minutes', async () => {
        const { token, email } = await register({ verified: false });
        await backdate(token, { expiresAt: new Date(Date.now() - 1000) });

        await expect(verifyDirectly(token, lastCode(email))).rejects.toThrow(
          /expired/,
        );
      });

      it('only accepts a code for the account it was sent to', async () => {
        const first = await register({ verified: false });
        const second = await register({ verified: false });

        const code = lastCode(first.email);

        // The same 6 digits, one in a million, would be the second's own code.
        if (code !== lastCode(second.email)) {
          await expect(verifyDirectly(second.token, code)).rejects.toThrow(
            'The code is wrong',
          );
        }
        await verifyDirectly(first.token, code);
      });

      it('resends at most once a minute, and the new code replaces the old one', async () => {
        const { token, email } = await register({ verified: false });
        const first = lastCode(email);

        const tooSoon = await resend(token).expect(429);
        expect((tooSoon.body as { message: string }).message).toMatch(
          /Wait \d+ seconds/,
        );
        expect(codesMailedTo(email)).toHaveLength(1);

        await backdate(token, { sentAt: new Date(Date.now() - 61_000) });
        await resend(token).expect(204);
        const second = lastCode(email);
        expect(codesMailedTo(email)).toHaveLength(2);

        if (first !== second) {
          await expect(verifyDirectly(token, first)).rejects.toThrow(
            'The code is wrong',
          );
        }
        await verify(token, second).expect(204);
      });

      it('confirms users straight away while mail is off', async () => {
        jest.spyOn(app.get(Mailer), 'enabled', 'get').mockReturnValue(false);
        const { token, email } = await register({ verified: false });

        expect((await currentUser(token)).emailVerifiedAt).not.toBeNull();
        expect(codesMailedTo(email)).toEqual([]);
      });

      it('confirms on resend once mail has been turned off', async () => {
        const { token } = await register({ verified: false });
        jest.spyOn(app.get(Mailer), 'enabled', 'get').mockReturnValue(false);

        await resend(token).expect(204);
        expect((await currentUser(token)).emailVerifiedAt).not.toBeNull();
      });
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
        em().count(Like, { likeableId });

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

      it('controls liking posts and comments separately', async () => {
        const { token } = await register();
        const { id } = await currentUser(token);
        const post = await createPost(adminToken, true);
        const comment = await createComment(adminToken, post.id);
        const postUrl = `/api/posts/${post.id}/like`;
        const commentUrl = `/api/comments/${comment.id}/like`;
        await http()
          .put(`/api/users/${id}/roles`)
          .send({ roles: [] })
          .expect(200);
        await http()
          .put(`/api/users/${id}/permissions`)
          .send({ permissions: [PERMISSIONS.POSTS_LIKE] })
          .expect(200);

        await withToken(token).put(postUrl).expect(204);
        await withToken(token).delete(postUrl).expect(204);
        await withToken(token).put(commentUrl).expect(403);
        await withToken(token).delete(commentUrl).expect(403);

        await http()
          .put(`/api/users/${id}/permissions`)
          .send({ permissions: [PERMISSIONS.COMMENTS_LIKE] })
          .expect(200);

        await withToken(token).put(postUrl).expect(403);
        await withToken(token).delete(postUrl).expect(403);
        await withToken(token).put(commentUrl).expect(204);
        await withToken(token).delete(commentUrl).expect(204);
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

      // The counts are lazy formulas, so every response has to populate them.
      it('returns the counts from every response with posts or comments', async () => {
        const { token } = await register();
        const created = await createPost(adminToken, true);
        expect(created).toMatchObject({ likesCount: 0, commentsCount: 0 });

        const comment = await createComment(token, created.id);
        expect(comment).toMatchObject({ likesCount: 0 });
        await withToken(token).put(`/api/posts/${created.id}/like`).expect(204);
        await withToken(token)
          .put(`/api/comments/${comment.id}/like`)
          .expect(204);
        const postCounts = { likesCount: 1, commentsCount: 1 };
        const commentCounts = { likesCount: 1 };

        const list = await anonymous().get('/api/posts?limit=100').expect(200);
        expect(
          (list.body as Paginated<Post>).data.find((p) => p.id === created.id),
        ).toMatchObject(postCounts);

        const single = await anonymous()
          .get(`/api/posts/${created.id}`)
          .expect(200);
        expect(single.body).toMatchObject({
          ...postCounts,
          comments: { data: [commentCounts] },
        });

        const editedPost = await http()
          .patch(`/api/posts/${created.id}`)
          .send({ title: 'Edited' })
          .expect(200);
        expect(editedPost.body).toMatchObject(postCounts);

        const comments = await anonymous()
          .get(`/api/posts/${created.id}/comments`)
          .expect(200);
        expect(comments.body).toMatchObject({ data: [commentCounts] });

        const editedComment = await withToken(token)
          .patch(`/api/comments/${comment.id}`)
          .send({ content: 'Edited' })
          .expect(200);
        expect(editedComment.body).toMatchObject(commentCounts);

        // Loading them to check or change them does not count.
        const execute = jest.spyOn(
          app.get(EntityManager).getConnection(),
          'execute',
        );
        try {
          await withToken(token)
            .delete(`/api/posts/${created.id}/like`)
            .expect(204);
          await withToken(token)
            .delete(`/api/comments/${comment.id}/like`)
            .expect(204);
          const sql = execute.mock.calls.map(([query]) => query as string);
          expect(sql.join('\n')).toMatch(/from "posts"/);
          expect(sql.join('\n')).toMatch(/from "comments"/);
          expect(sql.join('\n')).not.toContain('COUNT(*)');
        } finally {
          execute.mockRestore();
        }
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
          { id: comment.id, authorId: null, author: null },
        ]);
      });

      it('shows the nickname of the author, but not the email', async () => {
        const { token, email, nickname } = await register();
        const { id } = await currentUser(token);
        const post = await createPost(adminToken, true);
        const author = { id, nickname };

        const created = await createComment(token, post.id);
        expect(created.author).toEqual(author);

        // Comments show the nickname the author has now.
        author.nickname = uniqueNickname();
        await withToken(token)
          .patch('/api/auth/me')
          .send({ nickname: author.nickname })
          .expect(200);

        const edited = await withToken(token)
          .patch(`/api/comments/${created.id}`)
          .send({ content: 'Edited' })
          .expect(200);
        const listed = await anonymous()
          .get(`/api/posts/${post.id}/comments`)
          .expect(200);
        const single = await anonymous()
          .get(`/api/posts/${post.id}`)
          .expect(200);
        const bodies = [
          edited.body as Comment,
          (listed.body as CursorPaginated<Comment>).data[0],
          (single.body as { comments: CursorPaginated<Comment> }).comments
            .data[0],
        ];
        for (const comment of bodies) {
          expect(comment.author).toEqual(author);
        }
        expect(JSON.stringify(bodies)).not.toContain(email);
      });

      describe('notifications', () => {
        type Notification = DatabaseNotification;

        // A published post by a new member, who gets its notifications.
        const createAuthoredPost = async () => {
          const author = await register();
          const { id } = await currentUser(author.token);
          const post = await createPost(author.token);
          await http()
            .patch(`/api/posts/${post.id}`)
            .send({ published: true })
            .expect(200);
          return { ...author, id, post };
        };

        const listNotifications = async (token: string, query = '') => {
          const response = await withToken(token)
            .get(`/api/notifications${query}`)
            .expect(200);
          return response.body as CursorPaginated<Notification>;
        };

        const unreadCount = async (token: string) => {
          const response = await withToken(token)
            .get('/api/auth/me')
            .expect(200);
          return (response.body as { unreadNotificationsCount: number })
            .unreadNotificationsCount;
        };

        const openStream = async (
          token: string | null,
          lastEventId?: string,
        ) => {
          const server = app.getHttpServer() as unknown as Server;
          if (!server.listening) {
            await new Promise<void>((resolve) => server.listen(0, resolve));
          }
          const { port } = server.address() as AddressInfo;
          const abort = new AbortController();
          const response = await fetch(
            `http://127.0.0.1:${port}/api/notifications/stream`,
            {
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
              },
              signal: abort.signal,
            },
          );
          const reader = response
            .body!.pipeThrough(new TextDecoderStream())
            .getReader();
          let buffer = '';

          // The next event, skipping comments such as heartbeats. Null once
          // the server has ended the stream.
          const next = async (): Promise<{
            event?: string;
            id?: string;
            data: unknown;
          } | null> => {
            for (;;) {
              const end = buffer.indexOf('\n\n');
              if (end >= 0) {
                const fields = new Map(
                  buffer
                    .slice(0, end)
                    .split('\n')
                    .filter((line) => line && !line.startsWith(':'))
                    .map((line) => {
                      const colon = line.indexOf(': ');
                      return [line.slice(0, colon), line.slice(colon + 2)];
                    }),
                );
                buffer = buffer.slice(end + 2);
                const data = fields.get('data');
                if (data) {
                  return {
                    event: fields.get('event'),
                    id: fields.get('id'),
                    data: JSON.parse(data) as unknown,
                  };
                }
                continue;
              }
              const { value, done } = await reader.read();
              if (done) {
                return null;
              }
              buffer += value;
            }
          };

          // The next notification, skipping unread counts.
          const nextNotification = async () => {
            for (;;) {
              const event = await next();
              if (!event || event.event === 'notification') {
                return event as {
                  event: string;
                  id: string;
                  data: Notification;
                } | null;
              }
            }
          };

          return {
            response,
            next,
            nextNotification,
            close: () => abort.abort(),
          };
        };

        it('notifies post authors of comments by others', async () => {
          const author = await createAuthoredPost();
          const commenter = await register();
          const { id: commenterId } = await currentUser(commenter.token);

          expect(await listNotifications(author.token)).toMatchObject({
            data: [],
            nextCursor: null,
          });

          const comment = await createComment(commenter.token, author.post.id);
          await createComment(author.token, author.post.id);

          const { data } = await listNotifications(author.token);
          expect(data).toHaveLength(1);
          expect(data[0]).toEqual({
            id: expect.any(String) as string,
            type: 'post.commented',
            data: {
              postId: author.post.id,
              postTitle: author.post.title,
              commentId: comment.id,
              commenter: { id: commenterId, nickname: commenter.nickname },
            },
            readAt: null,
            createdAt: expect.any(String) as string,
          });
          expect(JSON.stringify(data)).not.toContain(commenter.email);
          expect(await unreadCount(author.token)).toBe(1);

          expect((await listNotifications(commenter.token)).data).toEqual([]);
          expect(await unreadCount(commenter.token)).toBe(0);

          await anonymous().get('/api/notifications').expect(401);
        });

        it('notifies authors of new likes by others', async () => {
          const author = await createAuthoredPost();
          const { id: postId, title: postTitle } = author.post;
          const comment = await createComment(author.token, postId);
          const liker = await register();
          const { id: likerId } = await currentUser(liker.token);
          const postLike = `/api/posts/${postId}/like`;
          const commentLike = `/api/comments/${comment.id}/like`;

          await withToken(author.token).put(postLike).expect(204);
          await withToken(author.token).put(commentLike).expect(204);
          expect((await listNotifications(author.token)).data).toEqual([]);

          await withToken(liker.token).put(postLike).expect(204);
          await withToken(liker.token).put(commentLike).expect(204);
          // Liking again changes nothing, so it does not notify again.
          await withToken(liker.token).put(postLike).expect(204);
          await withToken(liker.token).put(commentLike).expect(204);

          const likerData = { id: likerId, nickname: liker.nickname };
          const { data } = await listNotifications(author.token);
          expect(data.map((n) => ({ type: n.type, data: n.data }))).toEqual([
            {
              type: 'comment.liked',
              data: {
                commentId: comment.id,
                postId,
                postTitle,
                liker: likerData,
              },
            },
            {
              type: 'post.liked',
              data: { postId, postTitle, liker: likerData },
            },
          ]);
          expect(JSON.stringify(data)).not.toContain(liker.email);
        });

        it('loads unread counts for a list of users in one query', async () => {
          const first = await createAuthoredPost();
          const second = await createAuthoredPost();
          await createComment(adminToken, first.post.id);
          await createComment(adminToken, first.post.id);
          await createComment(adminToken, second.post.id);
          const [read] = (await listNotifications(first.token)).data;
          await withToken(first.token)
            .put(`/api/notifications/${read.id}/read`)
            .expect(204);

          const manager = em();
          const execute = jest.spyOn(manager.getConnection(), 'execute');
          try {
            const users = await manager.find(
              User,
              { id: { $in: [first.id, second.id] } },
              { populate: ['unreadNotificationsCount'] },
            );

            expect(execute).toHaveBeenCalledTimes(1);
            // The count is a subquery column of the users query.
            expect(execute.mock.calls[0][0] as string).toMatch(
              /^select .*\(SELECT COUNT\(\*\)::int FROM "notifications" .*\) as "unreadNotificationsCount" from "users"/,
            );
            const counts = new Map(
              users.map((u) => [u.id, u.unreadNotificationsCount]),
            );
            expect(counts).toEqual(
              new Map([
                [first.id, 1],
                [second.id, 1],
              ]),
            );
          } finally {
            execute.mockRestore();
          }

          // Not counted unless asked for.
          const plain = await em().findOneOrFail(User, first.id);
          expect(plain.unreadNotificationsCount).toBeUndefined();
        });

        it('pages notifications newest first', async () => {
          const author = await createAuthoredPost();
          const comments: Comment[] = [];
          for (let i = 0; i < 3; i++) {
            comments.push(await createComment(adminToken, author.post.id));
          }
          const commentIds = (page: CursorPaginated<Notification>) =>
            page.data.map((n) => (n.data as { commentId: string }).commentId);

          const first = await listNotifications(author.token, '?limit=2');
          expect(commentIds(first)).toEqual([comments[2].id, comments[1].id]);
          expect(first.nextCursor).toBe(first.data[1].id);

          const second = await listNotifications(
            author.token,
            `?limit=2&after=${first.nextCursor}`,
          );
          expect(commentIds(second)).toEqual([comments[0].id]);
          expect(second.nextCursor).toBeNull();
        });

        it('marks notifications as read and unread', async () => {
          const author = await createAuthoredPost();
          const { token: otherToken } = await register();
          await createComment(adminToken, author.post.id);
          await createComment(adminToken, author.post.id);
          const [newer, older] = (await listNotifications(author.token)).data;
          const readUrl = `/api/notifications/${older.id}/read`;

          await anonymous().put(readUrl).expect(401);
          await withToken(otherToken).put(readUrl).expect(404);
          await withToken(otherToken).delete(readUrl).expect(404);
          await withToken(author.token)
            .put('/api/notifications/not-a-uuid/read')
            .expect(400);

          await withToken(author.token).put(readUrl).expect(204);
          expect(await unreadCount(author.token)).toBe(1);
          const [, read] = (await listNotifications(author.token)).data;
          expect(read.readAt).not.toBeNull();

          // Keeps when it was first read.
          await withToken(author.token).put(readUrl).expect(204);
          const [, readAgain] = (await listNotifications(author.token)).data;
          expect(readAgain.readAt).toBe(read.readAt);

          await withToken(author.token).delete(readUrl).expect(204);
          expect(await unreadCount(author.token)).toBe(2);

          await withToken(author.token)
            .post('/api/notifications/read-all')
            .expect(204);
          expect(await unreadCount(author.token)).toBe(0);
          const listed = await listNotifications(author.token);
          expect(listed.data.map((n) => n.id)).toEqual([newer.id, older.id]);
          expect(listed.data.every((n) => n.readAt)).toBe(true);
        });

        it('streams notifications as they are sent', async () => {
          await expect(openStream(null)).resolves.toMatchObject({
            response: { status: 401 },
          });

          const author = await createAuthoredPost();
          const other = await createAuthoredPost();
          const stream = await openStream(author.token);
          try {
            expect(stream.response.status).toBe(200);
            expect(stream.response.headers.get('content-type')).toContain(
              'text/event-stream',
            );

            // Another user's notification does not reach the stream, so the
            // first event is the author's.
            await createComment(adminToken, other.post.id);
            await createComment(adminToken, author.post.id);
            const event = await stream.nextNotification();

            const [stored] = (await listNotifications(author.token)).data;
            expect(event).toEqual({
              event: 'notification',
              id: stored.id,
              data: stored,
            });
          } finally {
            stream.close();
          }
        });

        it('replays the notifications a stream missed', async () => {
          const author = await createAuthoredPost();
          await createComment(adminToken, author.post.id);
          const [seen] = (await listNotifications(author.token)).data;

          // Missed while disconnected, and replayed even once read.
          await createComment(adminToken, author.post.id);
          await createComment(adminToken, author.post.id);
          const [newest, missed] = (await listNotifications(author.token)).data;
          await withToken(author.token)
            .put(`/api/notifications/${missed.id}/read`)
            .expect(204);

          const stream = await openStream(author.token, seen.id);
          try {
            expect((await stream.nextNotification())?.id).toBe(missed.id);
            expect((await stream.nextNotification())?.id).toBe(newest.id);

            await createComment(adminToken, author.post.id);
            const [live] = (await listNotifications(author.token)).data;
            expect((await stream.nextNotification())?.id).toBe(live.id);
          } finally {
            stream.close();
          }

          // Without a valid Last-Event-ID, only new ones are sent.
          const fresh = await openStream(author.token, 'not-a-uuid');
          try {
            await createComment(adminToken, author.post.id);
            const [latest] = (await listNotifications(author.token)).data;
            expect((await fresh.nextNotification())?.id).toBe(latest.id);
          } finally {
            fresh.close();
          }
        });

        it('sends the unread count after the missed notifications', async () => {
          const author = await createAuthoredPost();

          // Without notifications there is nothing to resume after.
          const empty = await openStream(author.token);
          try {
            expect(await empty.next()).toEqual({
              event: 'unread-count',
              id: '',
              data: { count: 0 },
            });
          } finally {
            empty.close();
          }

          await createComment(adminToken, author.post.id);
          await createComment(adminToken, author.post.id);
          const [newest, older] = (await listNotifications(author.token)).data;
          await withToken(author.token)
            .put(`/api/notifications/${older.id}/read`)
            .expect(204);

          const stream = await openStream(author.token, older.id);
          try {
            expect(await stream.next()).toMatchObject({
              event: 'notification',
              id: newest.id,
            });
            // Resumes after the newest, which the count includes.
            expect(await stream.next()).toEqual({
              event: 'unread-count',
              id: newest.id,
              data: { count: 1 },
            });

            // Later ones add to the count.
            await createComment(adminToken, author.post.id);
            const [live] = (await listNotifications(author.token)).data;
            expect(await stream.next()).toMatchObject({
              event: 'notification',
              id: live.id,
            });
          } finally {
            stream.close();
          }
          expect(await unreadCount(author.token)).toBe(2);
        });

        it('ends the streams on shutdown', async () => {
          const { token } = await register();
          const stream = await openStream(token);
          try {
            app.get(NotificationBroadcaster).beforeApplicationShutdown();
            await expect(stream.nextNotification()).resolves.toBeNull();
          } finally {
            stream.close();
          }
        });

        describe('mail', () => {
          class MailedNotification extends AppNotification {
            readonly type = 'test.mailed';

            constructor(
              private readonly channels: NotificationChannelName[] = ['mail'],
            ) {
              super();
            }

            via() {
              return this.channels;
            }

            toDatabase() {
              return {};
            }

            toMail(user: MailRecipient) {
              return new MailMessage()
                .subject('Welcome')
                .greeting(`Hi ${user.nickname}!`)
                .action('Open', '/posts/1');
            }
          }

          const send = (userIds: string[], notification: AppNotification) =>
            RequestContext.create(em(), () =>
              app.get(NotificationsService).send(userIds, notification),
            );

          let mailerSend: jest.SpyInstance;
          beforeEach(() => {
            mailerSend = jest
              .spyOn(app.get(Mailer), 'send')
              .mockResolvedValue(undefined);
          });
          afterEach(() => mailerSend.mockRestore());

          const registerWithId = async () => {
            const user = await register();
            return { ...user, id: (await currentUser(user.token)).id };
          };

          it('mails users at their email', async () => {
            const first = await registerWithId();
            const second = await registerWithId();

            await send(
              [first.id, second.id],
              new MailedNotification(['database', 'mail']),
            );

            expect(mailerSend).toHaveBeenCalledTimes(2);
            for (const user of [first, second]) {
              expect(mailerSend).toHaveBeenCalledWith({
                to: user.email,
                subject: 'Welcome',
                text: `Hi ${user.nickname}!\n\nOpen: http://app.test/posts/1`,
                html: expect.stringContaining(
                  'href="http://app.test/posts/1"',
                ) as string,
              });
              const { data } = await listNotifications(user.token);
              expect(data.map((n) => n.type)).toEqual(['test.mailed']);
            }
          });

          it('skips deleted users, and a failed mail stops no other', async () => {
            const first = await registerWithId();
            const second = await registerWithId();
            mailerSend.mockRejectedValueOnce(new Error('SMTP is down'));

            await expect(
              send(
                [first.id, randomUUID(), second.id],
                new MailedNotification(),
              ),
            ).resolves.toBeUndefined();

            expect(
              mailerSend.mock.calls.map(([mail]) => (mail as Mail).to),
            ).toEqual([first.email, second.email]);
          });

          it('does not fail for a notification without toMail', async () => {
            class Unmailable extends AppNotification {
              readonly type = 'test.unmailable';
              via(): NotificationChannelName[] {
                return ['mail'];
              }
              toDatabase() {
                return {};
              }
            }
            const { id } = await registerWithId();

            await expect(send([id], new Unmailable())).resolves.toBeUndefined();
            expect(mailerSend).not.toHaveBeenCalled();
          });

          it('is left out of likes', async () => {
            const author = await createAuthoredPost();
            const comment = await createComment(author.token, author.post.id);
            await withToken(adminToken)
              .put(`/api/posts/${author.post.id}/like`)
              .expect(204);
            await withToken(adminToken)
              .put(`/api/comments/${comment.id}/like`)
              .expect(204);

            expect((await listNotifications(author.token)).data).toHaveLength(
              2,
            );
            expect(mailerSend).not.toHaveBeenCalled();
          });

          it('mails post authors about comments, with an excerpt', async () => {
            const author = await createAuthoredPost();
            const { nickname: commenter } = await currentUser(adminToken);
            const { id: postId, title } = author.post;
            const long = `${'word '.repeat(60)}\n\nend`;
            await withToken(adminToken)
              .post(`/api/posts/${postId}/comments`)
              .send({ content: long })
              .expect(201);

            expect(mailerSend).toHaveBeenCalledTimes(1);
            const [mail] = mailerSend.mock.calls[0] as [Mail];
            const excerpt = `${'word '.repeat(39)}word…`;
            expect(mail).toMatchObject({
              to: author.email,
              subject: `New comment on "${title}"`,
              text: [
                `Hi ${author.nickname}!`,
                `${commenter} commented on your post "${title}":`,
                excerpt,
                `View the post: http://app.test/api/posts/${postId}`,
              ].join('\n\n'),
            });
            expect(excerpt).toHaveLength(200);
            expect(mail.text).not.toContain('end');

            // Not for their own comments.
            await createComment(author.token, postId);
            expect(mailerSend).toHaveBeenCalledTimes(1);
          });
        });
      });
    });

    describe('permission sync', () => {
      const sync = () => em().transactional(syncPermissions);
      const roleNamed = async (name: string) => {
        const roles = await http().get('/api/roles').expect(200);
        return (roles.body as Role[]).find((r) => r.name === name) as Role;
      };
      const permissionsOf = async (name: string) =>
        (await roleNamed(name)).permissions.map((p) => p.name);

      it('deletes permissions that are no longer in the code', async () => {
        const manager = em();
        const member = await manager.findOneOrFail(
          Role,
          { name: 'member' },
          { populate: ['permissions'] },
        );
        member.permissions.add(
          manager.create(Permission, { name: 'old.permission' }),
        );
        await manager.flush();

        await sync();

        await expect(
          em().count(Permission, { name: 'old.permission' }),
        ).resolves.toBe(0);
        expect(await permissionsOf('member')).not.toContain('old.permission');
      });

      it('grants new permissions to the roles that default to them', async () => {
        await em().nativeDelete(Permission, {
          name: [PERMISSIONS.COMMENTS_LIKE, PERMISSIONS.POSTS_PUBLISH],
        });

        await sync();

        expect(await permissionsOf('member')).toContain(
          PERMISSIONS.COMMENTS_LIKE,
        );
        expect(await permissionsOf('member')).not.toContain(
          PERMISSIONS.POSTS_PUBLISH,
        );
        expect(await permissionsOf('editor')).toEqual(
          expect.arrayContaining([
            PERMISSIONS.COMMENTS_LIKE,
            PERMISSIONS.POSTS_PUBLISH,
          ]),
        );
        expect(await permissionsOf(ADMIN_ROLE)).toEqual(
          expect.arrayContaining([
            PERMISSIONS.COMMENTS_LIKE,
            PERMISSIONS.POSTS_PUBLISH,
          ]),
        );
      });

      it('keeps edits to existing roles', async () => {
        const member = await roleNamed('member');
        const original = member.permissions.map((p) => p.name);

        await http()
          .patch(`/api/roles/${member.id}`)
          .send({
            permissions: [
              ...original.filter((name) => name !== PERMISSIONS.POSTS_LIKE),
              PERMISSIONS.USERS_READ,
            ],
          })
          .expect(200);

        await sync();

        const synced = await permissionsOf('member');
        expect(synced).not.toContain(PERMISSIONS.POSTS_LIKE);
        expect(synced).toContain(PERMISSIONS.USERS_READ);

        await http()
          .patch(`/api/roles/${member.id}`)
          .send({ permissions: original })
          .expect(200);
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
