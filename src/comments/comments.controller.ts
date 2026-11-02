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
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto';
import { CommentAccess } from './comment-access.guard';
import { Comment } from './comment.entity';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('posts/:postId/comments')
  @CheckPolicies((ability) => ability.can('create', Comment))
  create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.create(postId, dto, user);
  }

  @Public()
  @Get('posts/:postId/comments')
  findAllForPost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: CursorPaginationQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.commentsService.findAllForPost(postId, query, user);
  }

  @Patch('comments/:id')
  @CommentAccess('update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.update(id, dto, user.id);
  }

  @Delete('comments/:id')
  @CommentAccess('delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.commentsService.remove(id);
  }

  @Put('comments/:id/like')
  @CheckPolicies((ability) => ability.can('like', Comment))
  @HttpCode(HttpStatus.NO_CONTENT)
  like(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.like(id, user);
  }

  @Delete('comments/:id/like')
  @CheckPolicies((ability) => ability.can('like', Comment))
  @HttpCode(HttpStatus.NO_CONTENT)
  unlike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.unlike(id, user);
  }
}
