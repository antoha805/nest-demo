import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  ParseUUIDPipe,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../auth/authenticated-user';
import { CommentAction, CommentsService } from './comments.service';

const COMMENT_ACTION_KEY = 'commentAction';

@Injectable()
export class CommentAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly commentsService: CommentsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<CommentAction>(
      COMMENT_ACTION_KEY,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user as AuthenticatedUser;

    // Guards run before pipes, so the route's own pipe has not checked this yet.
    const id = await new ParseUUIDPipe().transform(
      request.params.id as string,
      {
        type: 'param',
      },
    );
    return this.commentsService.can(action, id, user);
  }
}

// Allows the route only if the user can do this to the comment in the :id param.
export const CommentAccess = (action: CommentAction) =>
  applyDecorators(
    SetMetadata(COMMENT_ACTION_KEY, action),
    UseGuards(CommentAccessGuard),
  );
