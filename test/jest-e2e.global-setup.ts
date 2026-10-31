// Must stay first: data-source reads DB_NAME when it is imported.
import './jest-e2e.setup';
import { DataSource, DataSourceOptions } from 'typeorm';
import dataSource from './../src/database/data-source';
import { syncPermissions } from './../src/database/sync-permissions';

export default async function globalSetup() {
  const admin = new DataSource({
    ...dataSource.options,
    database: 'postgres',
    entities: [],
    migrations: [],
  } as DataSourceOptions);
  const database = `"${String(dataSource.options.database)}"`;

  await admin.initialize();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${database}`);
  } finally {
    await admin.destroy();
  }

  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
    await dataSource.transaction(syncPermissions);
  } finally {
    await dataSource.destroy();
  }
}
