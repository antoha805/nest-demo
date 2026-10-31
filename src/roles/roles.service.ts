import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ADMIN_ROLE } from './permission-names';
import { Permission } from './permission.entity';
import { Role } from './role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
  ) {}

  async create({ name, permissions }: CreateRoleDto): Promise<Role> {
    return this.rolesRepository.save(
      this.rolesRepository.create({
        name,
        permissions: await this.findPermissionsByNames(permissions),
      }),
    );
  }

  findAll(): Promise<Role[]> {
    return this.rolesRepository.find({
      relations: { permissions: true },
      order: { name: 'ASC' },
    });
  }

  findOne(id: string): Promise<Role> {
    return this.rolesRepository.findOneOrFail({
      where: { id },
      relations: { permissions: true },
    });
  }

  async update(
    id: string,
    { name, permissions }: UpdateRoleDto,
  ): Promise<Role> {
    const role = await this.findOne(id);
    this.assertNotAdmin(role);
    if (name !== undefined) {
      role.name = name;
    }
    if (permissions !== undefined) {
      role.permissions = await this.findPermissionsByNames(permissions);
    }
    return this.rolesRepository.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.rolesRepository.findOneBy({ id });
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    this.assertNotAdmin(role);
    await this.rolesRepository.delete(id);
  }

  findAllPermissions(): Promise<Permission[]> {
    return this.permissionsRepository.find({ order: { name: 'ASC' } });
  }

  findPermissionsByNames(names: string[]): Promise<Permission[]> {
    return this.permissionsRepository.findBy({ name: In(names) });
  }

  async findRolesByNames(names: string[]): Promise<Role[]> {
    const roles = await this.rolesRepository.findBy({ name: In(names) });
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
