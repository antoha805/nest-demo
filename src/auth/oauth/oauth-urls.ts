import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';

// What MCP clients may ask for. Reading is always granted; writing only when
// the user agrees to it on the consent page.
export const MCP_READ_SCOPE = 'mcp:read';
export const MCP_WRITE_SCOPE = 'mcp:write';
export const MCP_SCOPES = [MCP_READ_SCOPE, MCP_WRITE_SCOPE];

// The app's URLs as OAuth names them, all from APP_URL. The app is both the
// authorization server, at the root, and the resource the tokens are for.
@Injectable()
export class OAuthUrls {
  // Where /authorize, /token and the metadata are, per RFC 8414.
  readonly issuer: URL;
  // The MCP endpoint: the audience of the tokens issued here.
  readonly mcpResource: URL;
  // Where clients learn which authorization server issues tokens for /api/mcp.
  readonly protectedResourceMetadata: string;
  // The audience of the tokens POST /api/auth/login issues, so the two kinds
  // of token cannot be used in each other's place.
  readonly restAudience: string;
  // The audience of the signed request the consent page sends back, so it
  // cannot pass for a token either.
  readonly consentAudience: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const appUrl = config.get('APP_URL', { infer: true });
    this.issuer = new URL('/', appUrl);
    this.mcpResource = new URL('/api/mcp', appUrl);
    this.protectedResourceMetadata = getOAuthProtectedResourceMetadataUrl(
      this.mcpResource,
    );
    this.restAudience = new URL('/api', appUrl).href;
    this.consentAudience = new URL('/api/oauth/consent', appUrl).href;
  }
}
