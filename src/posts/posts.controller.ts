import {
  Body,
  Controller,
  Delete,
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
import { CheckPolicies } from '../casl/check-policies.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { FindPostsQueryDto } from './dto/find-posts-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostAccess } from './post-access.guard';
import { Post as PostEntity } from './post.entity';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @CheckPolicies((ability) => ability.can('create', PostEntity))
  create(@Body() dto: CreatePostDto, @CurrentUser() user: AuthenticatedUser) {
    this.postsService.assertCanPublish(dto, user);
    return this.postsService.create(dto, user.id);
  }

  @Public()
  @Get()
  findAll(
    @Query() query: FindPostsQueryDto,
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
    this.postsService.assertCanPublish(dto, user);
    return this.postsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @PostAccess('delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.remove(id);
  }

  // Needs posts.publish alone, not the right to edit the post too, so
  // reviewers can publish posts they cannot change. Publishing is final.
  @Put(':id/publish')
  @PostAccess('publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.publish(id);
  }

  @Put(':id/like')
  @CheckPolicies((ability) => ability.can('like', PostEntity))
  @HttpCode(HttpStatus.NO_CONTENT)
  like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postsService.like(id, user);
  }

  @Delete(':id/like')
  @CheckPolicies((ability) => ability.can('like', PostEntity))
  @HttpCode(HttpStatus.NO_CONTENT)
  unlike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postsService.unlike(id, user);
  }
}
