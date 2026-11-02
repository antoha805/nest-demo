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
  POSTS_LIKE: 'posts.like',
  COMMENTS_CREATE: 'comments.create',
  COMMENTS_UPDATE_OWN: 'comments.update.own',
  COMMENTS_DELETE_ALL: 'comments.delete.all',
  COMMENTS_DELETE_OWN: 'comments.delete.own',
  COMMENTS_LIKE: 'comments.like',
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

// The sync applies them when it creates the role, and later only grants permissions
// that are new, as roles can be edited through the API.
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionName[]> = {
  [EDITOR_ROLE]: [
    PERMISSIONS.CATEGORIES_CREATE,
    PERMISSIONS.CATEGORIES_UPDATE,
    PERMISSIONS.CATEGORIES_DELETE,
    PERMISSIONS.POSTS_CREATE,
    PERMISSIONS.POSTS_UPDATE_ALL,
    PERMISSIONS.POSTS_DELETE_ALL,
    PERMISSIONS.POSTS_PUBLISH,
    PERMISSIONS.COMMENTS_CREATE,
    PERMISSIONS.COMMENTS_UPDATE_OWN,
    PERMISSIONS.COMMENTS_DELETE_ALL,
    PERMISSIONS.POSTS_LIKE,
    PERMISSIONS.COMMENTS_LIKE,
  ],
  [MEMBER_ROLE]: [
    PERMISSIONS.POSTS_CREATE,
    PERMISSIONS.POSTS_UPDATE_OWN,
    PERMISSIONS.POSTS_DELETE_OWN,
    PERMISSIONS.COMMENTS_CREATE,
    PERMISSIONS.COMMENTS_UPDATE_OWN,
    PERMISSIONS.COMMENTS_DELETE_OWN,
    PERMISSIONS.POSTS_LIKE,
    PERMISSIONS.COMMENTS_LIKE,
  ],
};
