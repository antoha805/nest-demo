import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { PERMISSION_NAMES, PermissionName } from '../permission-names';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_NAMES, { each: true })
  permissions: PermissionName[];
}
