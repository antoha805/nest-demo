// Stored in the database by src/database/sync-permissions.ts on each deploy.
export const PERMISSIONS = {
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',
  CATEGORIES_DELETE: 'categories.delete',
  POSTS_CREATE: 'posts.create',
  POSTS_UPDATE_ALL: 'posts.update.all',
  POSTS_UPDATE_OWN: 'posts.update.own',
  POSTS_DELETE_ALL: 'posts.delete.all',
  POSTS_DELETE_OWN: 'posts.delete.own',
  POSTS_PUBLISH: 'posts.publish',
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_NAMES = Object.values(PERMISSIONS);

export const ADMIN_ROLE = 'admin';

export const EDITOR_ROLE = 'editor';

// Given to every new user.
export const MEMBER_ROLE = 'member';

// Only applied when the sync creates the role, as they can be edited through the API.
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionName[]> = {
  [EDITOR_ROLE]: [
    PERMISSIONS.CATEGORIES_CREATE,
    PERMISSIONS.CATEGORIES_UPDATE,
    PERMISSIONS.CATEGORIES_DELETE,
    PERMISSIONS.POSTS_CREATE,
    PERMISSIONS.POSTS_UPDATE_ALL,
    PERMISSIONS.POSTS_DELETE_ALL,
    PERMISSIONS.POSTS_PUBLISH,
  ],
  [MEMBER_ROLE]: [
    PERMISSIONS.POSTS_CREATE,
    PERMISSIONS.POSTS_UPDATE_OWN,
    PERMISSIONS.POSTS_DELETE_OWN,
  ],
};
