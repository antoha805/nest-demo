// Must stay first: it sets DB_NAME before .env is read.
import './jest-e2e.setup';
import { existsSync } from 'node:fs';
import { MikroORM } from '@mikro-orm/postgresql';
import 'reflect-metadata';
import { validate } from './../src/config/env.validation';
import { migrate } from './../src/database/migrate';
import { createOrmConfig } from './../src/database/mikro-orm.config';
import { syncPermissions } from './../src/database/sync-permissions';

export default async function globalSetup() {
  // Does not override the variables jest-e2e.setup has set.
  if (existsSync('.env')) {
    process.loadEnvFile();
  }
  const config = createOrmConfig(validate(process.env));
  const database = `"${config.dbName}"`;

  const admin = await MikroORM.init({ ...config, dbName: 'postgres' });
  try {
    const connection = admin.em.getConnection();
    await connection.execute(
      `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`,
    );
    await connection.execute(`CREATE DATABASE ${database}`);
  } finally {
    await admin.close();
  }

  const orm = await MikroORM.init({
    ...config,
    migrations: { ...config.migrations, silent: true },
  });
  try {
    await migrate(orm, 'up');
    await orm.em.fork().transactional(syncPermissions);
  } finally {
    await orm.close();
  }
}
