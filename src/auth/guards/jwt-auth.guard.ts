import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
  toAuthenticatedUser,
} from '../authenticated-user';
import { IS_MCP_RESOURCE_KEY } from '../decorators/mcp-resource.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OAuthProvider } from '../oauth/oauth.provider';
import { OAuthUrls } from '../oauth/oauth-urls';

// Whose token it is, and for an MCP token, what its scopes allow.
interface TokenAccess {
  userId: string;
  scopes?: string[];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly oauthProvider: OAuthProvider,
    private readonly urls: OAuthUrls,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const targets = [context.getHandler(), context.getClass()];
    const isMcp = this.reflector.getAllAndOverride<boolean>(
      IS_MCP_RESOURCE_KEY,
      targets,
    );
    const user = await this.resolveUser(request, isMcp);
    if (user) {
      request.user = user;
      return true;
    }

    // Public routes can still use the user, such as to show their own drafts.
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    if (isPublic) {
      return true;
    }
    throw new UnauthorizedException();
  }

  private async resolveUser(
    request: AuthenticatedRequest,
    isMcp: boolean | undefined,
  ): Promise<AuthenticatedUser | null> {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      return null;
    }

    // Each kind of token only where it is meant for, by its audience.
    const access = isMcp
      ? await this.oauthProvider.verifyMcpToken(token)
      : await this.verifyRestToken(token);
    if (!access) {
      return null;
    }

    // Access is read on every request, so changes apply to issued tokens.
    const user = await this.usersService.findWithAccess(access.userId);
    if (!user) {
      return null;
    }
    request.tokenScopes = access.scopes;
    return toAuthenticatedUser(user);
  }

  private async verifyRestToken(token: string): Promise<TokenAccess | null> {
    try {
      const { sub } = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        { audience: this.urls.restAudience },
      );
      return { userId: sub };
    } catch {
      return null;
    }
  }
}
