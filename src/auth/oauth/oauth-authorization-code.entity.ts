import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { User } from '../../users/user.entity';
import { OAuthClient } from './oauth-client.entity';

// The code a client gets after the user agrees, to exchange for tokens once,
// within minutes, with the PKCE verifier only that client knows.
@Entity({ tableName: 'oauth_authorization_codes' })
export class OAuthAuthorizationCode {
  // A SHA-256 of the code, never the code, so reading the table does not
  // reveal it. The code is random, so no key is needed.
  @PrimaryKey({ type: 'varchar', length: 64 })
  codeHash!: string;

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

  @Property({ type: 'text' })
  redirectUri!: string;

  @Property({ type: 'varchar', length: 128 })
  codeChallenge!: string;

  @Property({ type: 'datetime', columnType: 'timestamptz' })
  expiresAt!: Date;
}
