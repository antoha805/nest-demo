// Stored in the database by src/database/sync-permissions.ts on each deploy.
export const PERMISSIONS = {
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',
  CATEGORIES_DELETE: 'categories.delete',
  POSTS_CREATE: 'posts.create',
  POSTS_UPDATE: 'posts.update',
  POSTS_DELETE: 'posts.delete',
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_NAMES = Object.values(PERMISSIONS);

export const ADMIN_ROLE = 'admin';

export const EDITOR_ROLE = 'editor';

export const EDITOR_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.CATEGORIES_CREATE,
  PERMISSIONS.CATEGORIES_UPDATE,
  PERMISSIONS.CATEGORIES_DELETE,
  PERMISSIONS.POSTS_CREATE,
  PERMISSIONS.POSTS_UPDATE,
  PERMISSIONS.POSTS_DELETE,
];
