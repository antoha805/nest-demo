import { ArrayUnique, IsArray, IsIn } from 'class-validator';
import { PERMISSION_NAMES, PermissionName } from '../../roles/permission-names';

export class SetUserPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_NAMES, { each: true })
  permissions: PermissionName[];
}
