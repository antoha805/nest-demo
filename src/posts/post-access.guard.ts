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
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { PostsService } from './posts.service';

type PostAction = 'update' | 'delete';

const POST_ACTION_KEY = 'postAction';

@Injectable()
export class PostAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly postsService: PostsService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<PostAction>(
      POST_ACTION_KEY,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Guards run before pipes, so the route's own pipe has not checked this yet.
    const id = await new ParseUUIDPipe().transform(
      request.params.id as string,
      {
        type: 'param',
      },
    );
    const post = await this.postsService.findOne(id);

    return this.caslAbilityFactory
      .createForUser(request.user as AuthenticatedUser)
      .can(action, post);
  }
}

// Allows the route only if the user can do this to the post in the :id param.
export const PostAccess = (action: PostAction) =>
  applyDecorators(
    SetMetadata(POST_ACTION_KEY, action),
    UseGuards(PostAccessGuard),
  );
