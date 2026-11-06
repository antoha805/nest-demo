import { EntityManager } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ADMIN_ROLE, MEMBER_ROLE } from './permission-names';
import { Permission } from './permission.entity';
import { Role } from './role.entity';

@Injectable()
export class RolesService {
  constructor(private readonly em: EntityManager) {}

  async create({ name, permissions }: CreateRoleDto): Promise<Role> {
    const role = this.em.create(Role, {
      name,
      permissions: await this.findPermissionsByNames(permissions),
    });
    await this.em.flush();
    return role;
  }

  findAll(): Promise<Role[]> {
    return this.em.find(
      Role,
      {},
      { populate: ['permissions'], orderBy: { name: 'asc' } },
    );
  }

  findOne(id: string): Promise<Role> {
    return this.em.findOneOrFail(Role, id, { populate: ['permissions'] });
  }

  async update(
    id: string,
    { name, permissions }: UpdateRoleDto,
  ): Promise<Role> {
    const role = await this.findOne(id);
    this.assertNotAdmin(role);
    if (role.name === MEMBER_ROLE && name !== undefined && name !== role.name) {
      throw new ConflictException('The member role cannot be renamed');
    }
    if (name !== undefined) {
      role.name = name;
    }
    if (permissions !== undefined) {
      role.permissions.set(await this.findPermissionsByNames(permissions));
    }
    await this.em.flush();
    return role;
  }

  async remove(id: string): Promise<void> {
    const role = await this.em.findOne(Role, id);
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    this.assertNotAdmin(role);
    // Registration assigns this role.
    if (role.name === MEMBER_ROLE) {
      throw new ConflictException('The member role cannot be deleted');
    }
    await this.em.nativeDelete(Role, { id });
  }

  findAllPermissions(): Promise<Permission[]> {
    return this.em.find(Permission, {}, { orderBy: { name: 'asc' } });
  }

  findPermissionsByNames(names: string[]): Promise<Permission[]> {
    return this.em.find(Permission, { name: { $in: names } });
  }

  async findRolesByNames(names: string[]): Promise<Role[]> {
    const roles = await this.em.find(Role, { name: { $in: names } });
    if (roles.length !== names.length) {
      const found = new Set(roles.map((role) => role.name));
      const unknown = names.filter((name) => !found.has(name));
      throw new BadRequestException(`Unknown roles: ${unknown.join(', ')}`);
    }
    return roles;
  }

  // make-admin depends on this role, and it must keep every permission.
  private assertNotAdmin(role: Role): void {
    if (role.name === ADMIN_ROLE) {
      throw new ConflictException('The admin role cannot be changed');
    }
  }
}
