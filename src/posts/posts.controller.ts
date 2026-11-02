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
  Put,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Like } from '../likes/like.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostAccess } from './post-access.guard';
import { Post as PostEntity } from './post.entity';
import { PostsService } from './posts.service';

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
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.postsService.findAll(query, user);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.postsService.findVisibleWithComments(id, user);
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
      userId: user.id,
    });
  }

  @Delete(':id')
  @PostAccess('delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.remove(id);
  }

  @Put(':id/like')
  @CheckPolicies((ability) => ability.can('create', Like))
  @HttpCode(HttpStatus.NO_CONTENT)
  like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postsService.like(id, user);
  }

  @Delete(':id/like')
  @CheckPolicies((ability) => ability.can('delete', Like))
  @HttpCode(HttpStatus.NO_CONTENT)
  unlike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postsService.unlike(id, user);
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
}
