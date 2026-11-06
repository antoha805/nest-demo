import { Collection, type Opt } from '@mikro-orm/core';
import {
  Entity,
  ManyToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { Permission } from '../roles/permission.entity';
import { Role } from '../roles/role.entity';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: Opt<string>;

  @Property({ type: 'varchar', length: 254, unique: true })
  email!: string;

  // Only loaded by UsersService.findCredentials, and never serialized.
  @Property({ type: 'varchar', length: 60, lazy: true, hidden: true })
  passwordHash!: string;

  @ManyToMany({
    entity: () => Role,
    pivotTable: 'user_roles',
    joinColumn: 'userId',
    inverseJoinColumn: 'roleId',
  })
  roles = new Collection<Role>(this);

  // Granted directly, in addition to those from the user's roles.
  @ManyToMany({
    entity: () => Permission,
    pivotTable: 'user_permissions',
    joinColumn: 'userId',
    inverseJoinColumn: 'permissionId',
  })
  permissions = new Collection<Permission>(this);

  @Property({
    type: 'datetime',
    columnType: 'timestamptz',
    defaultRaw: 'now()',
  })
  createdAt: Opt<Date> = new Date();

  @Property({
    type: 'datetime',
    columnType: 'timestamptz',
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
