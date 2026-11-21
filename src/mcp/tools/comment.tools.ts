import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedUser } from '../../auth/authenticated-user';
import { Comment } from '../../comments/comment.entity';
import { CommentsService } from '../../comments/comments.service';
import { CreateCommentDto } from '../../comments/dto/create-comment.dto';
import { UpdateCommentDto } from '../../comments/dto/update-comment.dto';
import { CursorPaginationQueryDto } from '../../common/dto/cursor-pagination-query.dto';
import {
  DESTRUCTIVE,
  IDEMPOTENT_WRITE,
  McpToolkit,
  READ_ONLY,
  WRITE,
} from '../mcp-toolkit';

const commentId = z.uuid().describe('The id of the comment.');

@Injectable()
export class CommentTools {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly toolkit: McpToolkit,
  ) {}

  register(server: McpServer, user?: AuthenticatedUser): void {
    const { toolkit, commentsService } = this;

    server.registerTool(
      'list_comments',
      {
        title: 'List comments',
        description:
          "Lists a post's comments, newest first. For the next page, pass the " +
          'nextCursor of the previous one as cursor; it is null on the last page.',
        inputSchema: {
          postId: z.uuid().describe('The id of the post.'),
          cursor: z.uuid().optional(),
          limit: z
            .number()
            .int()
            .optional()
            .describe('Comments per page, from 1 to 100. Defaults to 20.'),
        },
        annotations: READ_ONLY,
      },
      ({ postId, ...query }) =>
        toolkit.run(async () =>
          commentsService.findAllForPost(
            postId,
            await toolkit.validate(CursorPaginationQueryDto, query),
            user,
          ),
        ),
    );

    server.registerTool(
      'create_comment',
      {
        title: 'Comment on a post',
        description: 'Adds a comment to a post, and notifies its author.',
        inputSchema: {
          postId: z.uuid().describe('The id of the post.'),
          content: z.string().describe('Up to 5000 characters.'),
        },
        annotations: WRITE,
      },
      ({ postId, ...fields }) =>
        toolkit.run(async () => {
          const current = toolkit.authorize(user, (ability) =>
            ability.can('create', Comment),
          );
          const dto = await toolkit.validate(CreateCommentDto, fields);
          return commentsService.create(postId, dto, current);
        }),
    );

    server.registerTool(
      'update_comment',
      {
        title: 'Update a comment',
        description: 'Changes the content of a comment you wrote.',
        inputSchema: {
          id: commentId,
          content: z.string().describe('Up to 5000 characters.'),
        },
        annotations: WRITE,
      },
      ({ id, ...fields }) =>
        toolkit.run(async () => {
          const current = toolkit.requireUser(user);
          toolkit.assertAllowed(
            await commentsService.can('update', id, current),
          );
          const dto = await toolkit.validate(UpdateCommentDto, fields);
          return commentsService.update(id, dto, current.id);
        }),
    );

    server.registerTool(
      'delete_comment',
      {
        title: 'Delete a comment',
        description: 'Deletes a comment with its likes. This cannot be undone.',
        inputSchema: { id: commentId },
        annotations: DESTRUCTIVE,
      },
      ({ id }) =>
        toolkit.run(async () => {
          const current = toolkit.requireUser(user);
          toolkit.assertAllowed(
            await commentsService.can('delete', id, current),
          );
          await commentsService.remove(id);
        }, 'Comment deleted'),
    );

    server.registerTool(
      'like_comment',
      {
        title: 'Like a comment',
        description: 'Likes a comment. Liking it again does nothing.',
        inputSchema: { id: commentId },
        annotations: IDEMPOTENT_WRITE,
      },
      ({ id }) =>
        toolkit.run(
          () =>
            commentsService.like(
              id,
              toolkit.authorize(user, (ability) =>
                ability.can('like', Comment),
              ),
            ),
          'Comment liked',
        ),
    );

    server.registerTool(
      'unlike_comment',
      {
        title: 'Unlike a comment',
        description: 'Removes your like from a comment, if any.',
        inputSchema: { id: commentId },
        annotations: IDEMPOTENT_WRITE,
      },
      ({ id }) =>
        toolkit.run(
          () =>
            commentsService.unlike(
              id,
              toolkit.authorize(user, (ability) =>
                ability.can('like', Comment),
              ),
            ),
          'Like removed',
        ),
    );
  }
}
