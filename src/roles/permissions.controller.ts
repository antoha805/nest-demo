import { Controller, Get } from '@nestjs/common';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Role } from './role.entity';
import { RolesService } from './roles.service';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', Role))
  findAll() {
    return this.rolesService.findAllPermissions();
  }
}
