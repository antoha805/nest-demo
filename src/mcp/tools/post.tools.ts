import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedUser } from '../../auth/authenticated-user';
import { CreatePostDto } from '../../posts/dto/create-post.dto';
import { FindPostsQueryDto } from '../../posts/dto/find-posts-query.dto';
import { UpdatePostDto } from '../../posts/dto/update-post.dto';
import { Post } from '../../posts/post.entity';
import { PostsService } from '../../posts/posts.service';
import {
  DESTRUCTIVE,
  IDEMPOTENT_WRITE,
  McpToolkit,
  READ_ONLY,
  WRITE,
} from '../mcp-toolkit';

const postId = z.uuid().describe('The id of the post.');

// The schemas give the shape; the DTOs check the rules, as for REST.
@Injectable()
export class PostTools {
  constructor(
    private readonly postsService: PostsService,
    private readonly toolkit: McpToolkit,
  ) {}

  register(server: McpServer, user?: AuthenticatedUser): void {
    const { toolkit, postsService } = this;

    server.registerTool(
      'search_posts',
      {
        title: 'Search posts',
        description:
          'Lists posts, newest first, or the best matches first when searching. ' +
          'The query searches titles and contents in web search syntax: ' +
          '"a phrase", -excluded, or. Returns a page of posts with its total. ' +
          'Drafts are included only for their author and for publishers.',
        inputSchema: {
          q: z
            .string()
            .optional()
            .describe(
              'The search query, up to 200 characters. Leave it out to list all posts.',
            ),
          page: z.number().int().optional().describe('From 1. Defaults to 1.'),
          limit: z
            .number()
            .int()
            .optional()
            .describe('Posts per page, from 1 to 100. Defaults to 20.'),
        },
        annotations: READ_ONLY,
      },
      (args) =>
        toolkit.run(async () =>
          postsService.findAll(
            await toolkit.validate(FindPostsQueryDto, args),
            user,
          ),
        ),
    );

    server.registerTool(
      'get_post',
      {
        title: 'Get a post',
        description:
          'Gets a post by its id, with its newest comments. Use list_comments for more.',
        inputSchema: { id: postId },
        annotations: READ_ONLY,
      },
      ({ id }) =>
        toolkit.run(() => postsService.findVisibleWithComments(id, user)),
    );

    server.registerTool(
      'create_post',
      {
        title: 'Create a post',
        description:
          'Creates a post as a draft, or publishes it at once with published: true, ' +
          'which needs the posts.publish permission and cannot be undone. ' +
          'Publishing announces the post to every user.',
        inputSchema: {
          title: z.string().describe('Up to 200 characters.'),
          content: z.string(),
          categoryId: z.uuid().describe('See list_categories.'),
          published: z.boolean().optional(),
        },
        annotations: WRITE,
      },
      (args) =>
        toolkit.run(async () => {
          const current = toolkit.authorize(user, (ability) =>
            ability.can('create', Post),
          );
          const dto = await toolkit.validate(CreatePostDto, args);
          postsService.assertCanPublish(dto, current);
          return postsService.create(dto, current.id);
        }),
    );

    server.registerTool(
      'update_post',
      {
        title: 'Update a post',
        description:
          'Changes the fields given. published: true publishes a draft, which ' +
          'needs posts.publish and cannot be undone.',
        inputSchema: {
          id: postId,
          title: z.string().optional().describe('Up to 200 characters.'),
          content: z.string().optional(),
          categoryId: z.uuid().optional(),
          published: z.literal(true).optional(),
        },
        annotations: WRITE,
      },
      ({ id, ...fields }) =>
        toolkit.run(async () => {
          const current = toolkit.requireUser(user);
          toolkit.assertAllowed(await postsService.can('update', id, current));
          const dto = await toolkit.validate(UpdatePostDto, fields);
          postsService.assertCanPublish(dto, current);
          return postsService.update(id, dto, current.id);
        }),
    );

    server.registerTool(
      'delete_post',
      {
        title: 'Delete a post',
        description:
          'Deletes a post with its comments and likes. This cannot be undone.',
        inputSchema: { id: postId },
        annotations: DESTRUCTIVE,
      },
      ({ id }) =>
        toolkit.run(async () => {
          const current = toolkit.requireUser(user);
          toolkit.assertAllowed(await postsService.can('delete', id, current));
          await postsService.remove(id);
        }, 'Post deleted'),
    );

    server.registerTool(
      'publish_post',
      {
        title: 'Publish a post',
        description:
          'Publishes a draft and announces it to every user. Publishing is final: ' +
          'a published post cannot become a draft again. Publishing a published ' +
          'post does nothing.',
        inputSchema: { id: postId },
        annotations: { ...DESTRUCTIVE, idempotentHint: true },
      },
      ({ id }) =>
        toolkit.run(async () => {
          const current = toolkit.requireUser(user);
          toolkit.assertAllowed(await postsService.can('publish', id, current));
          await postsService.publish(id);
        }, 'Post published'),
    );

    server.registerTool(
      'like_post',
      {
        title: 'Like a post',
        description: 'Likes a post. Liking it again does nothing.',
        inputSchema: { id: postId },
        annotations: IDEMPOTENT_WRITE,
      },
      ({ id }) =>
        toolkit.run(
          () =>
            postsService.like(
              id,
              toolkit.authorize(user, (ability) => ability.can('like', Post)),
            ),
          'Post liked',
        ),
    );

    server.registerTool(
      'unlike_post',
      {
        title: 'Unlike a post',
        description: 'Removes your like from a post, if any.',
        inputSchema: { id: postId },
        annotations: IDEMPOTENT_WRITE,
      },
      ({ id }) =>
        toolkit.run(
          () =>
            postsService.unlike(
              id,
              toolkit.authorize(user, (ability) => ability.can('like', Post)),
            ),
          'Like removed',
        ),
    );
  }
}
