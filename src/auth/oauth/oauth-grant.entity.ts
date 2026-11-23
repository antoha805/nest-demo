import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { User } from '../../users/user.entity';
import { OAuthClient } from './oauth-client.entity';

// A user's consent to a client, from exchanging the code until it is revoked
// or the refresh token expires unused. Access tokens name their grant and
// stop working when it is deleted, so revoking takes effect at once.
@Entity({ tableName: 'oauth_grants' })
export class OAuthGrant {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: Opt<string>;

  @ManyToOne(() => OAuthClient, {
    fieldName: 'clientId',
    mapToPk: true,
    deleteRule: 'cascade',
    updateRule: 'no action',
  })
  clientId!: string;

  @ManyToOne(() => User, {
    fieldName: 'userId',
    mapToPk: true,
    deleteRule: 'cascade',
    updateRule: 'no action',
  })
  userId!: string;

  // Space-separated, as OAuth writes them.
  @Property({ type: 'varchar', length: 255 })
  scope!: string;

  // SHA-256 hashes, like the codes'. Each refresh replaces the token, and the
  // one it replaced is kept: if that is used again, it was copied, so the
  // grant is revoked.
  @Property({ type: 'varchar', length: 64, unique: true })
  refreshTokenHash!: string;

  @Property({ type: 'varchar', length: 64, nullable: true, unique: true })
  previousRefreshTokenHash: string | null = null;

  // Moved on with each refresh, so a client in use stays connected.
  @Property({ type: 'datetime', columnType: 'timestamptz' })
  expiresAt!: Date;

  @Property({
    type: 'datetime',
    columnType: 'timestamptz',
    defaultRaw: 'now()',
  })
  createdAt!: Opt<Date>;
}
