import type { Opt } from '@mikro-orm/core';
import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { User } from '../users/user.entity';

// The code a user was mailed to confirm their email. One per user, as a new
// code replaces the old one, and deleted once the email is confirmed.
@Entity({ tableName: 'email_verifications' })
export class EmailVerification {
  @ManyToOne(() => User, {
    fieldName: 'userId',
    mapToPk: true,
    primary: true,
    deleteRule: 'cascade',
    updateRule: 'no action',
  })
  userId!: string;

  // An HMAC of the code, never the code, so reading the table does not reveal
  // it. Keyed with JWT_SECRET, so the million possible codes cannot be tried
  // offline either.
  @Property({ type: 'varchar', length: 64 })
  codeHash!: string;

  // Wrong codes tried so far. The code stops working at a limit, so it cannot
  // be guessed.
  @Property({ type: 'integer', default: 0 })
  attempts: Opt<number> = 0;

  @Property({ type: 'datetime', columnType: 'timestamptz' })
  expiresAt!: Date;

  // When it was mailed, so a new one cannot be requested too soon.
  @Property({ type: 'datetime', columnType: 'timestamptz' })
  sentAt!: Date;
}
