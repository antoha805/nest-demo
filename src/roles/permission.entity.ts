import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;
}
