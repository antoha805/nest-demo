// Adding a name here also needs a migration that inserts it and grants it to admin.
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
