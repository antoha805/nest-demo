import { Request } from 'express';
import { User } from '../users/user.entity';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  const permissions = [
    ...user.permissions,
    ...user.roles.flatMap((role) => role.permissions),
  ].map((permission) => permission.name);

  return {
    id: user.id,
    email: user.email,
    roles: user.roles.map((role) => role.name),
    permissions: [...new Set(permissions)].sort(),
  };
}
