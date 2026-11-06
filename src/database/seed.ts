import { randomUUID } from 'node:crypto';
import { EntityManager } from '@mikro-orm/postgresql';
import { NestFactory } from '@nestjs/core';
import { hash } from 'bcrypt';
import { AppModule } from '../app.module';
import { Category } from '../categories/category.entity';
import { Comment } from '../comments/comment.entity';
import { Like, LikeableType } from '../likes/like.entity';
import { Post } from '../posts/post.entity';
import { User } from '../users/user.entity';

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

const ANA = 'seed-ana@example.com';
const BEN = 'seed-ben@example.com';
const CLEO = 'seed-cleo@example.com';

const postLikes = [
  { post: 'Getting started with NestJS', likedBy: [ANA, BEN, CLEO] },
  { post: 'Why PostgreSQL is a solid default', likedBy: [BEN] },
  { post: 'A weekend in Lisbon', likedBy: [ANA, CLEO] },
  { post: 'The perfect tomato soup', likedBy: [CLEO] },
];

const comments = [
  {
    post: 'Getting started with NestJS',
    author: ANA,
    content: 'This finally made dependency injection click for me.',
    likedBy: [BEN, CLEO],
  },
  {
    post: 'Getting started with NestJS',
    author: BEN,
    content: 'A follow-up on guards would be great.',
    likedBy: [ANA],
  },
  {
    post: 'Why PostgreSQL is a solid default',
    author: CLEO,
    content: 'Agreed, and the JSON support covers most of my document needs.',
    likedBy: [],
  },
  {
    post: 'A weekend in Lisbon',
    author: BEN,
    content: 'Tram 28 gets crowded, so go early in the morning.',
    likedBy: [ANA, CLEO],
  },
  {
    post: 'A weekend in Lisbon',
    author: CLEO,
    content: 'The tarts in Belem were worth the queue.',
    likedBy: [],
  },
  {
    post: 'The perfect tomato soup',
    author: ANA,
    content: 'A little smoked paprika works really well here.',
    likedBy: [CLEO],
  },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    await app
      .get(EntityManager)
      .fork()
      .transactional(async (em) => {
        await em.upsertMany(Category, categories, {
          onConflictFields: ['name'],
        });
        const savedCategories = await em.find(Category, {});
        const categoryIds = new Map(savedCategories.map((c) => [c.name, c.id]));

        let created = 0;
        for (const { category, ...post } of posts) {
          if (!(await em.count(Post, { title: post.title }))) {
            await em.insert(Post, {
              ...post,
              category: categoryIds.get(category) as string,
            });
            created++;
          }
        }

        // The password is random and thrown away, so nobody can log in as them.
        const passwordHash = await hash(randomUUID(), 12);
        let createdUsers = 0;
        for (const email of [ANA, BEN, CLEO]) {
          if (!(await em.count(User, { email }))) {
            const nickname = email.split('@')[0].replace('-', '_');
            await em.insert(User, { email, nickname, passwordHash });
            createdUsers++;
          }
        }
        const savedUsers = await em.find(User, {
          email: { $in: [ANA, BEN, CLEO] },
        });
        const userIds = new Map(savedUsers.map((u) => [u.email, u.id]));
        const userId = (email: string) => userIds.get(email) as string;

        let createdLikes = 0;
        const addLikes = async (
          likeableType: LikeableType,
          likeableId: string,
          likedBy: string[],
        ) => {
          for (const email of likedBy) {
            const like = { likeableType, likeableId, userId: userId(email) };
            if (!(await em.count(Like, like))) {
              await em.insert(Like, like);
              createdLikes++;
            }
          }
        };
        const postId = async (title: string) =>
          (await em.findOneOrFail(Post, { title })).id;

        for (const { post, likedBy } of postLikes) {
          await addLikes(LikeableType.POST, await postId(post), likedBy);
        }

        let createdComments = 0;
        for (const { post, author, content, likedBy } of comments) {
          const comment = {
            postId: await postId(post),
            author: userId(author),
            content,
          };
          let id = (await em.findOne(Comment, comment))?.id;
          if (!id) {
            id = await em.insert(Comment, comment);
            createdComments++;
          }
          await addLikes(LikeableType.COMMENT, id, likedBy);
        }

        console.log(
          `Upserted ${categories.length} categories, created ${created} posts, ${createdUsers} users, ${createdComments} comments and ${createdLikes} likes`,
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
