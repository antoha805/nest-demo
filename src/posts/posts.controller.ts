import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostAccess } from './post-access.guard';
import { Post as PostEntity } from './post.entity';
import { PostsService, PostVisibility } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  @Post()
  @CheckPolicies((ability) => ability.can('create', PostEntity))
  create(@Body() dto: CreatePostDto, @CurrentUser() user: AuthenticatedUser) {
    this.assertCanSetPublished(dto, user);
    return this.postsService.create(dto, user.id);
  }

  @Public()
  @Get()
  findAll(@CurrentUser() user?: AuthenticatedUser) {
    return this.postsService.findAll(this.visibilityFor(user));
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.postsService.findVisible(id, this.visibilityFor(user));
  }

  @Patch(':id')
  @PostAccess('update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertCanSetPublished(dto, user);
    return this.postsService.update(id, dto, {
      keepPublished: this.canPublish(user),
    });
  }

  @Delete(':id')
  @PostAccess('delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.remove(id);
  }

  private canPublish(user: AuthenticatedUser): boolean {
    return this.caslAbilityFactory
      .createForUser(user)
      .can('publish', PostEntity);
  }

  private assertCanSetPublished(
    { published }: { published?: boolean },
    user: AuthenticatedUser,
  ): void {
    if (published && !this.canPublish(user)) {
      throw new ForbiddenException('You cannot publish posts');
    }
  }

  // Publishers have to see drafts in order to review them.
  private visibilityFor(user?: AuthenticatedUser): PostVisibility {
    return user
      ? { includeDrafts: this.canPublish(user), draftsByAuthorId: user.id }
      : { includeDrafts: false };
  }
}
