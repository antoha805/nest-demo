import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Permission } from '../roles/permission.entity';
import { Role } from '../roles/role.entity';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'varchar', length: 254, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 60, select: false })
  passwordHash: string;

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId' },
    inverseJoinColumn: { name: 'roleId' },
  })
  roles: Role[];

  // Granted directly, in addition to those from the user's roles.
  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'user_permissions',
    joinColumn: { name: 'userId' },
    inverseJoinColumn: { name: 'permissionId' },
  })
  permissions: Permission[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
