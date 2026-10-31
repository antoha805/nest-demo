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
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = await this.verifyToken(request);

    // Access is read on every request, so changes apply to issued tokens.
    const user = await this.usersService.findWithAccess(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = toAuthenticatedUser(user);
    return true;
  }

  private async verifyToken(request: AuthenticatedRequest): Promise<string> {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    try {
      const { sub } = await this.jwtService.verifyAsync<{ sub: string }>(token);
      return sub;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
