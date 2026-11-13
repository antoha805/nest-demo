import { Collection, type Opt } from '@mikro-orm/core';
import {
  Entity,
  Formula,
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

  // Shown to other users, such as on comments, so the email can stay private.
  @Property({ type: 'varchar', length: 30, unique: true })
  nickname!: string;

  // In E.164, such as +4915112345678, for SMS notifications. Private like the
  // email, and not confirmed: the user's word is taken for it.
  @Property({ type: 'varchar', length: 16, nullable: true })
  phone: string | null = null;

  // Only loaded by UsersService.findCredentials, and never serialized.
  @Property({ type: 'varchar', length: 60, lazy: true, hidden: true })
  passwordHash!: string;

  // Null until the user confirms their email. Until then, they get no
  // permissions from their roles, so they can read but not write.
  @Property({ type: 'datetime', columnType: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null = null;

  // Lazy, so only queries that populate it pay for the count, such as
  // GET /api/auth/me. A list that does gets it as a subquery column of the
  // same query, rather than a query per user. Undefined when not populated.
  @Formula(
    (cols) =>
      `(SELECT COUNT(*)::int FROM "notifications" WHERE "notifications"."userId" = ${cols.id} AND "notifications"."readAt" IS NULL)`,
    { type: 'integer', lazy: true },
  )
  unreadNotificationsCount?: Opt<number>;

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
