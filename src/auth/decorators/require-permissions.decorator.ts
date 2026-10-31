import { SetMetadata } from '@nestjs/common';
import { PermissionName } from '../../roles/permission-names';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

// The user must hold all of the listed permissions.
export const RequirePermissions = (...permissions: PermissionName[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
