import { createHash, randomBytes } from 'node:crypto';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import {
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { sendConsentPage } from './consent-page';
import { OAuthAuthorizationCode } from './oauth-authorization-code.entity';
import { OAuthClient } from './oauth-client.entity';
import { OAuthGrant } from './oauth-grant.entity';
import {
  MCP_READ_SCOPE,
  MCP_SCOPES,
  MCP_WRITE_SCOPE,
  OAuthUrls,
} from './oauth-urls';

const CONSENT_TTL_SECONDS = 10 * 60;
const CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
// Since the last refresh, so a client in use stays connected.
const GRANT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// An authorization request /authorize checked, until the user answers it on
// the consent page. Signed rather than stored, so it cannot be changed there.
export interface ConsentRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  // What the client asked for, of MCP_SCOPES.
  scope: string;
}

export interface McpAccess {
  userId: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
}

interface AccessTokenClaims {
  sub: string;
  exp: number;
  // The grant, which the token stops working without.
  gid: string;
  client_id: string;
  scope: string;
}

// The authorization server for MCP clients, behind the endpoints the MCP SDK
// serves: /register, /authorize, /token and /revoke. Access tokens are JWTs
// for /api/mcp only, and refresh tokens are random, stored hashed.
//
// The SDK's routes run outside Nest's request context, so each method uses
// its own EntityManager.
@Injectable()
export class OAuthProvider implements OAuthServerProvider {
  constructor(
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
    private readonly urls: OAuthUrls,
  ) {}

  readonly clientsStore: OAuthRegisteredClientsStore = {
    getClient: async (clientId) => {
      if (!UUID.test(clientId)) {
        return undefined;
      }
      const client = await this.em.fork().findOne(OAuthClient, clientId);
      return client?.information;
    },
    // The SDK has generated the client_id by now.
    registerClient: async (registration) => {
      const information = registration as OAuthClientInformationFull;
      const em = this.em.fork();
      em.create(OAuthClient, { id: information.client_id, information });
      await em.flush();
      return information;
    },
  };

  // Shows the consent page, as the request is valid: the SDK has checked the
  // client, its redirect URI and the PKCE challenge.
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    this.checkResource(params.resource);
    const request: ConsentRequest = {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state,
      scope: requestedScope(params.scopes),
    };
    sendConsentPage(res, {
      clientName: client.client_name,
      redirectUri: request.redirectUri,
      requestToken: await this.jwtService.signAsync(
        { ...request },
        {
          audience: this.urls.consentAudience,
          expiresIn: CONSENT_TTL_SECONDS,
        },
      ),
      writeRequested: request.scope.includes(MCP_WRITE_SCOPE),
    });
  }

  // The request the consent page sent back, with its client, or null if it
  // expired, was tampered with, or the client is gone.
  async readConsentRequest(requestToken: string): Promise<{
    request: ConsentRequest;
    client: OAuthClientInformationFull;
  } | null> {
    let request: ConsentRequest;
    try {
      request = await this.jwtService.verifyAsync<ConsentRequest>(
        requestToken,
        { audience: this.urls.consentAudience },
      );
    } catch {
      return null;
    }
    const client = await this.clientsStore.getClient(request.clientId);
    return client ? { request, client } : null;
  }

  // Where to send the user after they agree: back to the client, with a code
  // for the scopes they allowed.
  async approve(
    request: ConsentRequest,
    userId: string,
    allowWrite: boolean,
  ): Promise<string> {
    const scope =
      allowWrite && request.scope.includes(MCP_WRITE_SCOPE)
        ? `${MCP_READ_SCOPE} ${MCP_WRITE_SCOPE}`
        : MCP_READ_SCOPE;
    const code = randomToken();
    const em = this.em.fork();
    await em.nativeDelete(OAuthAuthorizationCode, {
      expiresAt: { $lte: new Date() },
    });
    em.create(OAuthAuthorizationCode, {
      codeHash: hashToken(code),
      clientId: request.clientId,
      userId,
      scope,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
    await em.flush();
    return redirectWith(request, { code });
  }

  // Where to send the user after they decline.
  deny(request: ConsentRequest): string {
    return redirectWith(request, {
      error: 'access_denied',
      error_description: 'The user denied access',
    });
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
  ): Promise<string> {
    return (await this.findCode(client, code)).codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    this.checkResource(resource);
    const authorization = await this.findCode(client, code);
    if (
      redirectUri !== undefined &&
      redirectUri !== authorization.redirectUri
    ) {
      throw new InvalidGrantError(
        'redirect_uri does not match the authorization',
      );
    }
    // Once only: of two requests with the same code, one deletes it.
    const em = this.em.fork();
    const deleted = await em.nativeDelete(OAuthAuthorizationCode, {
      codeHash: authorization.codeHash,
    });
    if (deleted !== 1) {
      throw new InvalidGrantError(
        'The authorization code is invalid or expired',
      );
    }

    await em.nativeDelete(OAuthGrant, { expiresAt: { $lte: new Date() } });
    const refreshToken = randomToken();
    const grant = em.create(OAuthGrant, {
      clientId: authorization.clientId,
      userId: authorization.userId,
      scope: authorization.scope,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + GRANT_TTL_MS),
    });
    await em.flush();
    return this.issueTokens(grant, refreshToken, grant.scope);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    this.checkResource(resource);
    const tokenHash = hashToken(refreshToken);
    const em = this.em.fork();
    const grant = await em.findOne(OAuthGrant, {
      clientId: client.client_id,
      $or: [
        { refreshTokenHash: tokenHash },
        { previousRefreshTokenHash: tokenHash },
      ],
    });
    if (!grant) {
      throw new InvalidGrantError('The refresh token is invalid or revoked');
    }
    // Replaced already, so someone else has a copy: revoked for both.
    if (grant.previousRefreshTokenHash === tokenHash) {
      await em.nativeDelete(OAuthGrant, { id: grant.id });
      throw new InvalidGrantError(
        'The refresh token was used before, so access was revoked',
      );
    }
    if (grant.expiresAt <= new Date()) {
      await em.nativeDelete(OAuthGrant, { id: grant.id });
      throw new InvalidGrantError('The refresh token has expired');
    }

    // A client may ask for fewer scopes than the user allowed, not more.
    const granted = grant.scope.split(' ');
    if (scopes?.some((scope) => !granted.includes(scope))) {
      throw new InvalidScopeError('The scopes exceed what the user allowed');
    }
    const scope = scopes?.length ? scopes.join(' ') : grant.scope;

    const next = randomToken();
    // Of two refreshes with the same token, one rotates it.
    const rotated = await em.nativeUpdate(
      OAuthGrant,
      { id: grant.id, refreshTokenHash: tokenHash },
      {
        refreshTokenHash: hashToken(next),
        previousRefreshTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + GRANT_TTL_MS),
      },
    );
    if (rotated !== 1) {
      throw new InvalidGrantError('The refresh token is invalid or revoked');
    }
    return this.issueTokens(grant, next, scope);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const access = await this.verifyMcpToken(token);
    if (!access) {
      throw new InvalidTokenError('The token is invalid or expired');
    }
    return {
      token,
      clientId: access.clientId,
      scopes: access.scopes,
      expiresAt: access.expiresAt,
      resource: this.urls.mcpResource,
      extra: { userId: access.userId },
    };
  }

  // For the guard of /api/mcp: whose token it is, or null if it is not a
  // valid one for /api/mcp, or its grant was revoked.
  async verifyMcpToken(token: string): Promise<McpAccess | null> {
    let claims: AccessTokenClaims;
    try {
      claims = await this.jwtService.verifyAsync<AccessTokenClaims>(token, {
        audience: this.urls.mcpResource.href,
        issuer: this.urls.issuer.href,
      });
    } catch {
      return null;
    }
    const grant = await this.em
      .fork()
      .findOne(
        OAuthGrant,
        { id: claims.gid, userId: claims.sub },
        { fields: ['id'] },
      );
    if (!grant) {
      return null;
    }
    return {
      userId: claims.sub,
      clientId: claims.client_id,
      scopes: claims.scope.split(' '),
      expiresAt: claims.exp,
    };
  }

  // Either token ends the whole grant, so the client has to ask again.
  async revokeToken(
    client: OAuthClientInformationFull,
    { token }: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const em = this.em.fork();
    const tokenHash = hashToken(token);
    const deleted = await em.nativeDelete(OAuthGrant, {
      clientId: client.client_id,
      $or: [
        { refreshTokenHash: tokenHash },
        { previousRefreshTokenHash: tokenHash },
      ],
    });
    if (deleted > 0) {
      return;
    }
    const access = await this.jwtService
      .verifyAsync<AccessTokenClaims>(token, {
        audience: this.urls.mcpResource.href,
        issuer: this.urls.issuer.href,
      })
      .catch(() => null);
    if (access?.client_id === client.client_id) {
      await em.nativeDelete(OAuthGrant, { id: access.gid });
    }
  }

  private async findCode(
    client: OAuthClientInformationFull,
    code: string,
  ): Promise<OAuthAuthorizationCode> {
    const authorization = await this.em.fork().findOne(OAuthAuthorizationCode, {
      codeHash: hashToken(code),
      clientId: client.client_id,
    });
    if (!authorization || authorization.expiresAt <= new Date()) {
      throw new InvalidGrantError(
        'The authorization code is invalid or expired',
      );
    }
    return authorization;
  }

  private async issueTokens(
    grant: OAuthGrant,
    refreshToken: string,
    scope: string,
  ): Promise<OAuthTokens> {
    const claims: Omit<AccessTokenClaims, 'sub' | 'exp'> = {
      gid: grant.id,
      client_id: grant.clientId,
      scope,
    };
    const accessToken = await this.jwtService.signAsync(claims, {
      subject: grant.userId,
      audience: this.urls.mcpResource.href,
      issuer: this.urls.issuer.href,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope,
      refresh_token: refreshToken,
    };
  }

  // Tokens are only for /api/mcp, so a client asking for another resource
  // is refused rather than given a token that would not work there.
  private checkResource(resource?: URL): void {
    if (
      resource &&
      withoutSlash(resource) !== withoutSlash(this.urls.mcpResource)
    ) {
      throw new InvalidTargetError(
        `Tokens are issued only for ${this.urls.mcpResource.href}`,
      );
    }
  }
}

// Reading always, and writing if asked for, or if no scope was asked for, as
// some clients do not ask. Unknown scopes are left out, as OAuth allows.
function requestedScope(scopes: string[] = []): string {
  const wantsWrite =
    scopes.length === 0 ||
    scopes.includes(MCP_WRITE_SCOPE) ||
    !scopes.some((scope) => MCP_SCOPES.includes(scope));
  return wantsWrite ? `${MCP_READ_SCOPE} ${MCP_WRITE_SCOPE}` : MCP_READ_SCOPE;
}

function redirectWith(
  request: ConsentRequest,
  params: Record<string, string>,
): string {
  const url = new URL(request.redirectUri);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  if (request.state !== undefined) {
    url.searchParams.set('state', request.state);
  }
  return url.href;
}

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function withoutSlash(url: URL): string {
  return url.href.replace(/#.*$/, '').replace(/\/$/, '');
}
