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
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../roles/permission-names';
import { SetUserPermissionsDto } from './dto/set-user-permissions.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id/roles')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  setRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRolesDto,
  ) {
    return this.usersService.setRoles(id, dto.roles);
  }

  @Put(':id/permissions')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPermissionsDto,
  ) {
    return this.usersService.setPermissions(id, dto.permissions);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
