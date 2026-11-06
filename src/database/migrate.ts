import { existsSync } from 'node:fs';
import { MikroORM } from '@mikro-orm/postgresql';
import 'reflect-metadata';
import { validate } from '../config/env.validation';
import { createOrmConfig } from './mikro-orm.config';

// The table TypeORM recorded its migrations in, before the move to MikroORM.
const TYPEORM_MIGRATIONS = 'migrations';

// Applies or reverts migrations, or creates one from the entities' schema diff.
export async function migrate(orm: MikroORM, command = 'up', name?: string) {
  const migrator = orm.migrator;

  switch (command) {
    case 'up':
      await adoptTypeOrmMigrations(orm);
      await migrator.up();
      return;
    case 'down':
      await migrator.down();
      return;
    case 'create': {
      if (!name) {
        throw new Error('Usage: npm run migration:create -- <Name>');
      }
      const { fileName, diff } = await migrator.create(
        undefined,
        false,
        false,
        name,
      );
      if (!diff.up.length) {
        console.log(
          'The schema matches the entities, so there is nothing to migrate',
        );
        return;
      }
      console.log(
        `Created ${fileName}: add it to src/database/migrations/index.ts`,
      );
      return;
    }
    case 'check':
      if (await migrator.checkSchema()) {
        throw new Error('The schema does not match the entities');
      }
      console.log('The schema matches the entities');
      return;
    default:
      throw new Error(`Unknown command ${command}`);
  }
}

// Databases migrated by TypeORM have run the same migrations under the same
// names, so they are recorded as applied instead of running again.
async function adoptTypeOrmMigrations(orm: MikroORM) {
  const migrator = orm.migrator;
  if ((await migrator.getExecuted()).length) {
    return;
  }
  const connection = orm.em.getConnection();
  const [{ exists }] = await connection.execute<{ exists: boolean }[]>(
    `SELECT to_regclass('"${TYPEORM_MIGRATIONS}"') IS NOT NULL AS "exists"`,
  );
  if (!exists) {
    return;
  }
  const applied = await connection.execute<{ name: string }[]>(
    `SELECT "name" FROM "${TYPEORM_MIGRATIONS}" ORDER BY "id"`,
  );
  for (const { name } of applied) {
    await migrator.logMigration(name);
    console.log(`Adopted ${name} from TypeORM`);
  }
}

// Runs outside Nest and its ConfigModule, so it reads .env itself.
async function main() {
  if (existsSync('.env')) {
    process.loadEnvFile();
  }
  const orm = await MikroORM.init(createOrmConfig(validate(process.env)));
  try {
    await migrate(orm, process.argv[2], process.argv[3]);
  } finally {
    await orm.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
