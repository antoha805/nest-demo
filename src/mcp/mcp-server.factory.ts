import { NotFoundError } from '@mikro-orm/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CategoriesService } from '../categories/categories.service';
import { FindPostsQueryDto } from '../posts/dto/find-posts-query.dto';
import { PostsService } from '../posts/posts.service';

// The tools only read, and only through the services the REST routes use, so
// they show each user exactly what the API would: drafts stay hidden from
// those who cannot see them.
const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

@Injectable()
export class McpServerFactory {
  private readonly logger = new Logger(McpServerFactory.name);

  constructor(
    private readonly postsService: PostsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  // A server for one request, acting as its user, or anonymously without one.
  create(user?: AuthenticatedUser): McpServer {
    const server = new McpServer(
      { name: 'nest-demo', version: '0.0.1' },
      {
        instructions:
          'A blog API. Search and read its posts and list its categories.',
      },
    );

    server.registerTool(
      'search_posts',
      {
        title: 'Search posts',
        description:
          'Lists posts, newest first, or the best matches first when searching. ' +
          'The query searches titles and contents in web search syntax: ' +
          '"a phrase", -excluded, or. Returns a page of posts with its total.',
        inputSchema: {
          q: z
            .string()
            .trim()
            .max(200)
            .optional()
            .describe('The search query. Leave it out to list all posts.'),
          page: z.number().int().min(1).max(1_000_000).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        },
        annotations: READ_ONLY,
      },
      ({ q, page, limit }) =>
        this.run(() =>
          this.postsService.findAll(
            Object.assign(new FindPostsQueryDto(), {
              q: q || undefined,
              page,
              limit,
            }),
            user,
          ),
        ),
    );

    server.registerTool(
      'get_post',
      {
        title: 'Get a post',
        description: 'Gets a post by its id, with its first page of comments.',
        inputSchema: { id: z.uuid().describe('The id of the post.') },
        annotations: READ_ONLY,
      },
      ({ id }) =>
        this.run(() => this.postsService.findVisibleWithComments(id, user)),
    );

    server.registerTool(
      'list_categories',
      {
        title: 'List categories',
        description:
          'Lists every category by name, with how many published posts it has.',
        annotations: READ_ONLY,
      },
      () => this.run(() => this.categoriesService.findAll()),
    );

    return server;
  }

  // Returns the result as JSON, and errors as tool errors the model can read.
  // Unexpected errors are logged and not described, as the SDK would otherwise
  // pass on their message, such as a database error.
  private async run(fn: () => Promise<unknown>): Promise<CallToolResult> {
    try {
      return { content: [{ type: 'text', text: JSON.stringify(await fn()) }] };
    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        return toolError('The requested record was not found');
      }
      if (error instanceof HttpException) {
        return toolError(error.message);
      }
      this.logger.error({ err: error }, 'An MCP tool failed');
      return toolError('Internal server error');
    }
  }
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
