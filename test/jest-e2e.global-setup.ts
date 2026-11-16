// Must stay first: it sets DB_NAME before .env is read.
import './jest-e2e.setup';
import { existsSync } from 'node:fs';
import { MikroORM } from '@mikro-orm/postgresql';
import { Queue } from 'bullmq';
import 'reflect-metadata';
import { validate } from './../src/config/env.validation';
import { migrate } from './../src/database/migrate';
import { createOrmConfig } from './../src/database/mikro-orm.config';
import { syncPermissions } from './../src/database/sync-permissions';
import { NOTIFICATIONS_QUEUE } from './../src/notifications/queue/notification-queue';

export default async function globalSetup() {
  // Does not override the variables jest-e2e.setup has set.
  if (existsSync('.env')) {
    process.loadEnvFile();
  }
  const env = validate(process.env);
  const config = createOrmConfig(env);
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

  // Drops the jobs of earlier runs, which the tests would otherwise find.
  const queue = new Queue(NOTIFICATIONS_QUEUE, {
    connection: { host: env.REDIS_HOST, port: env.REDIS_PORT },
    prefix: env.QUEUE_PREFIX,
  });
  try {
    await queue.obliterate({ force: true });
  } finally {
    await queue.close();
  }
}
