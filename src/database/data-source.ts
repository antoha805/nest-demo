import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Category } from '../categories/category.entity';
import { validate } from '../config/env.validation';
import { Post } from '../posts/post.entity';
import { Permission } from '../roles/permission.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';

// Used by the TypeORM CLI, which runs outside Nest and its ConfigModule.
if (existsSync('.env')) {
  process.loadEnvFile();
}

const env = validate(process.env);

export default new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: [Category, Post, User, Role, Permission],
  // Match this file's extension: dist also contains .d.ts files.
  migrations: [join(__dirname, 'migrations', `*${extname(__filename)}`)],
});
