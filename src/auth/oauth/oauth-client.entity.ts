import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

// An app that registered itself to ask users for access, such as claude.ai or
// Cursor, per RFC 7591. Anyone can register one: what it gets is up to the
// user who signs in on the consent page.
@Entity({ tableName: 'oauth_clients' })
export class OAuthClient {
  // The client_id the MCP SDK generates.
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  // As registered, with the client_secret of confidential clients in plain
  // text, as the SDK compares the secret it is sent with it. A secret alone
  // gets nothing: tokens also need a code from a user's consent, which is
  // bound to the client's PKCE verifier.
  @Property({ type: 'json' })
  information!: OAuthClientInformationFull;

  @Property({
    type: 'datetime',
    columnType: 'timestamptz',
    defaultRaw: 'now()',
  })
  createdAt!: Opt<Date>;
}
