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
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.resolveUser(request);
    if (user) {
      request.user = user;
      return true;
    }

    // Public routes can still use the user, such as to show their own drafts.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    throw new UnauthorizedException();
  }

  private async resolveUser(
    request: AuthenticatedRequest,
  ): Promise<AuthenticatedUser | null> {
    const userId = await this.verifyToken(request);
    if (!userId) {
      return null;
    }

    // Access is read on every request, so changes apply to issued tokens.
    const user = await this.usersService.findWithAccess(userId);
    return user && toAuthenticatedUser(user);
  }

  private async verifyToken(
    request: AuthenticatedRequest,
  ): Promise<string | null> {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      return null;
    }

    try {
      const { sub } = await this.jwtService.verifyAsync<{ sub: string }>(token);
      return sub;
    } catch {
      return null;
    }
  }
}
