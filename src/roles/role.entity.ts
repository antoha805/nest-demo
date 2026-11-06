import { Collection, type Opt } from '@mikro-orm/core';
import {
  Entity,
  ManyToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { Permission } from './permission.entity';

@Entity({ tableName: 'roles' })
export class Role {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: Opt<string>;

  @Property({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @ManyToMany({
    entity: () => Permission,
    pivotTable: 'role_permissions',
    joinColumn: 'roleId',
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
