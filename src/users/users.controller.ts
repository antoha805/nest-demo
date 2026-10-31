import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { SetUserPermissionsDto } from './dto/set-user-permissions.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', User))
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', User))
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id/roles')
  @CheckPolicies((ability) => ability.can('update', User))
  setRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRolesDto,
  ) {
    return this.usersService.setRoles(id, dto.roles);
  }

  @Put(':id/permissions')
  @CheckPolicies((ability) => ability.can('update', User))
  setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPermissionsDto,
  ) {
    return this.usersService.setPermissions(id, dto.permissions);
  }

  @Delete(':id')
  @CheckPolicies((ability) => ability.can('delete', User))
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
