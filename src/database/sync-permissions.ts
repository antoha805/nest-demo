import { EntityManager, In, Not } from 'typeorm';
import { Permission } from '../roles/permission.entity';
import {
  ADMIN_ROLE,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_NAMES,
} from '../roles/permission-names';
import { Role } from '../roles/role.entity';
import dataSource from './data-source';

// Safe to re-run. The code owns the permissions, as the API can only assign them.
export async function syncPermissions(manager: EntityManager): Promise<void> {
  await manager.delete(Permission, { name: Not(In(PERMISSION_NAMES)) });
  const existing = await manager.find(Permission);
  const existingNames = new Set(existing.map((p) => p.name));

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
    const names: string[] = defaults;
    const role = await manager.findOne(Role, {
      where: { name },
      relations: { permissions: true },
    });
    // An existing role only gets new permissions, so edits made through the API
    // are kept: a default that was removed from it stays removed.
    const granted = permissions.filter(
      (p) => names.includes(p.name) && (!role || !existingNames.has(p.name)),
    );
    await manager.save(Role, {
      ...(role ?? { name }),
      permissions: [...(role?.permissions ?? []), ...granted],
    });
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
