import { existsSync } from 'node:fs';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import 'reflect-metadata';
import { validate } from '../config/env.validation';
import { Permission } from '../roles/permission.entity';
import {
  ADMIN_ROLE,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_NAMES,
} from '../roles/permission-names';
import { Role } from '../roles/role.entity';
import { createOrmConfig } from './mikro-orm.config';

// Safe to re-run. The code owns the permissions, as the API can only assign them.
export async function syncPermissions(em: EntityManager): Promise<void> {
  await em.nativeDelete(Permission, { name: { $nin: PERMISSION_NAMES } });
  const existing = await em.find(Permission, {});
  const existingNames = new Set(existing.map((p) => p.name));

  await em
    .createQueryBuilder(Permission)
    .insert(PERMISSION_NAMES.map((name) => ({ name })))
    .onConflict('name')
    .ignore()
    .execute();
  const permissions = await em.find(Permission, {}, { refresh: true });

  const admin =
    (await em.findOne(
      Role,
      { name: ADMIN_ROLE },
      { populate: ['permissions'] },
    )) ?? em.create(Role, { name: ADMIN_ROLE });
  admin.permissions.set(permissions);

  for (const [name, defaults] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const names: string[] = defaults;
    const role = await em.findOne(
      Role,
      { name },
      { populate: ['permissions'] },
    );
    // An existing role only gets new permissions, so edits made through the API
    // are kept: a default that was removed from it stays removed.
    const granted = permissions.filter(
      (p) => names.includes(p.name) && (!role || !existingNames.has(p.name)),
    );
    (role ?? em.create(Role, { name })).permissions.add(granted);
  }
  await em.flush();
}

async function main() {
  if (existsSync('.env')) {
    process.loadEnvFile();
  }
  const orm = await MikroORM.init(createOrmConfig(validate(process.env)));
  try {
    await orm.em.fork().transactional(syncPermissions);
    console.log(`Synced ${PERMISSION_NAMES.length} permissions`);
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
