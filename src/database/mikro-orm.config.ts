import { EntityCaseNamingStrategy } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { Category } from '../categories/category.entity';
import { Comment } from '../comments/comment.entity';
import { EnvironmentVariables } from '../config/env.validation';
import { Like } from '../likes/like.entity';
import { Post } from '../posts/post.entity';
import { Permission } from '../roles/permission.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';
import { migrations } from './migrations';

type DatabaseEnv = Pick<
  EnvironmentVariables,
  'DB_HOST' | 'DB_PORT' | 'DB_USERNAME' | 'DB_PASSWORD' | 'DB_NAME'
>;

// Shared by the app and the scripts that run outside Nest and its ConfigModule.
export function createOrmConfig(env: DatabaseEnv) {
  return defineConfig({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    dbName: env.DB_NAME,
    entities: [Category, Post, Comment, Like, User, Role, Permission],
    // The schema names columns after the properties, such as "categoryId".
    namingStrategy: EntityCaseNamingStrategy,
    extensions: [Migrator],
    migrations: {
      // Listed rather than found on disk, so the scripts work from src and dist.
      migrationsList: migrations,
      pathTs: 'src/database/migrations',
      snapshot: false,
    },
    schemaGenerator: {
      // Where TypeORM recorded its migrations. Kept so the previous version can
      // still be deployed, and left out of schema diffs so they do not drop it.
      skipTables: ['migrations'],
    },
  });
}
