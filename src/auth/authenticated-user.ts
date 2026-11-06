import { Request } from 'express';
import { User } from '../users/user.entity';

export interface AuthenticatedUser {
  id: string;
  email: string;
  nickname: string;
  emailVerifiedAt: Date | null;
  roles: string[];
  // Empty until the email is confirmed.
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  // An unconfirmed user can still read and confirm, as reading and their own
  // account need no permission, but cannot write until they confirm.
  const permissions = user.emailVerifiedAt
    ? [
        ...user.permissions.getItems(),
        ...user.roles.getItems().flatMap((role) => role.permissions.getItems()),
      ].map((permission) => permission.name)
    : [];

  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    emailVerifiedAt: user.emailVerifiedAt,
    roles: user.roles.getItems().map((role) => role.name),
    permissions: [...new Set(permissions)].sort(),
  };
}
