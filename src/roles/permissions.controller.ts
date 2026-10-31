import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from './permission-names';
import { RolesService } from './roles.service';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  findAll() {
    return this.rolesService.findAllPermissions();
  }
}
