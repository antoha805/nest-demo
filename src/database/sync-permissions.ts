import { EntityManager } from 'typeorm';
import { Permission } from '../roles/permission.entity';
import {
  ADMIN_ROLE,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_NAMES,
} from '../roles/permission-names';
import { Role } from '../roles/role.entity';
import dataSource from './data-source';

// Safe to re-run. Never deletes: removing a permission takes access away from
// users, so that stays a deliberate migration.
export async function syncPermissions(manager: EntityManager): Promise<void> {
  await manager
    .createQueryBuilder()
    .insert()
    .into(Permission)
    .values(PERMISSION_NAMES.map((name) => ({ name })))
    .orIgnore()
    .execute();
  const permissions = await manager.find(Permission);

  const admin = await manager.findOneBy(Role, { name: ADMIN_ROLE });
  await manager.save(Role, {
    ...(admin ?? { name: ADMIN_ROLE }),
    permissions,
  });

  for (const [name, defaults] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (!(await manager.existsBy(Role, { name }))) {
      const names: string[] = defaults;
      await manager.save(Role, {
        name,
        permissions: permissions.filter((p) => names.includes(p.name)),
      });
    }
  }
}

async function main() {
  await dataSource.initialize();
  try {
    await dataSource.transaction(syncPermissions);
    console.log(`Synced ${PERMISSION_NAMES.length} permissions`);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
