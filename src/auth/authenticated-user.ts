import { Request } from 'express';
import { User } from '../users/user.entity';

export interface AuthenticatedUser {
  id: string;
  email: string;
  nickname: string;
  roles: string[];
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  const permissions = [
    ...user.permissions.getItems(),
    ...user.roles.getItems().flatMap((role) => role.permissions.getItems()),
  ].map((permission) => permission.name);

  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    roles: user.roles.getItems().map((role) => role.name),
    permissions: [...new Set(permissions)].sort(),
  };
}
