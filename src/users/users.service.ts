import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MEMBER_ROLE } from '../roles/permission-names';
import { RolesService } from '../roles/roles.service';
import { User } from './user.entity';

const WITH_ACCESS = {
  roles: { permissions: true },
  permissions: true,
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  async create(email: string, passwordHash: string): Promise<User> {
    const roles = await this.rolesService.findRolesByNames([MEMBER_ROLE]);
    return this.usersRepository.save(
      this.usersRepository.create({ email, passwordHash, roles }),
    );
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: WITH_ACCESS,
      order: { email: 'ASC' },
    });
  }

  findOne(id: string): Promise<User> {
    return this.usersRepository.findOneOrFail({
      where: { id },
      relations: WITH_ACCESS,
    });
  }

  findWithAccess(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: WITH_ACCESS,
    });
  }

  findCredentials(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      select: { id: true, passwordHash: true },
    });
  }

  async setRoles(id: string, roles: string[]): Promise<User> {
    const user = await this.findOne(id);
    user.roles = await this.rolesService.findRolesByNames(roles);
    await this.usersRepository.save(user);
    return this.findOne(id);
  }

  async setPermissions(id: string, permissions: string[]): Promise<User> {
    const user = await this.findOne(id);
    user.permissions =
      await this.rolesService.findPermissionsByNames(permissions);
    await this.usersRepository.save(user);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.usersRepository.delete(id);
    if (!affected) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }
}
