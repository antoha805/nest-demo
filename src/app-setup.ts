import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { INestApplication } from '@nestjs/common';
import { OAuthProvider } from './auth/oauth/oauth.provider';
import { MCP_SCOPES, OAuthUrls } from './auth/oauth/oauth-urls';

// What main.ts and the e2e tests share, so the tests run the app as deployed.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  // The OAuth endpoints MCP clients sign in with, at the root as RFC 8414
  // places them: /register, /authorize, /token, /revoke and the metadata
  // under /.well-known. Each limits requests per IP.
  const urls = app.get(OAuthUrls);
  app.use(
    mcpAuthRouter({
      provider: app.get(OAuthProvider),
      issuerUrl: urls.issuer,
      resourceServerUrl: urls.mcpResource,
      scopesSupported: MCP_SCOPES,
      resourceName: 'nest-demo',
    }),
  );
}
