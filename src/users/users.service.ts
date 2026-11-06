import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MEMBER_ROLE } from '../roles/permission-names';
import { RolesService } from '../roles/roles.service';
import { User } from './user.entity';

const WITH_ACCESS = ['roles.permissions', 'permissions'] as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
    private readonly rolesService: RolesService,
  ) {}

  async create(
    email: string,
    nickname: string,
    passwordHash: string,
  ): Promise<User> {
    const roles = await this.rolesService.findRolesByNames([MEMBER_ROLE]);
    const user = this.em.create(User, { email, nickname, passwordHash, roles });
    await this.em.flush();
    return user;
  }

  findAll(): Promise<User[]> {
    return this.em.find(
      User,
      {},
      { populate: WITH_ACCESS, orderBy: { email: 'asc' } },
    );
  }

  findOne(id: string): Promise<User> {
    // Refreshed, so it shows changes made in this request.
    return this.em.findOneOrFail(User, id, {
      populate: WITH_ACCESS,
      refresh: true,
    });
  }

  findWithAccess(id: string): Promise<User | null> {
    return this.em.findOne(User, id, { populate: WITH_ACCESS });
  }

  findCredentials(
    email: string,
  ): Promise<Pick<User, 'id' | 'passwordHash'> | null> {
    return this.em.findOne(User, { email }, { fields: ['id', 'passwordHash'] });
  }

  async setRoles(id: string, roles: string[]): Promise<User> {
    const user = await this.findOne(id);
    user.roles.set(await this.rolesService.findRolesByNames(roles));
    await this.em.flush();
    return this.findOne(id);
  }

  async setPermissions(id: string, permissions: string[]): Promise<User> {
    const user = await this.findOne(id);
    user.permissions.set(
      await this.rolesService.findPermissionsByNames(permissions),
    );
    await this.em.flush();
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.em.nativeDelete(User, { id }))) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }
}
