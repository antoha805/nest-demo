import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { McpPrompts } from './prompts';
import { AccountTools } from './tools/account.tools';
import { CategoryTools } from './tools/category.tools';
import { CommentTools } from './tools/comment.tools';
import { NotificationTools } from './tools/notification.tools';
import { PostTools } from './tools/post.tools';

// The tools call the services the REST routes use, after the same checks, so
// they show and allow each user exactly what the API would.
@Injectable()
export class McpServerFactory {
  constructor(
    private readonly postTools: PostTools,
    private readonly commentTools: CommentTools,
    private readonly categoryTools: CategoryTools,
    private readonly notificationTools: NotificationTools,
    private readonly accountTools: AccountTools,
    private readonly prompts: McpPrompts,
  ) {}

  // A server for one request, acting as its user. Without canWrite, from a
  // token the user allowed only to read, the tools that write refuse.
  create(
    user: AuthenticatedUser,
    { canWrite }: { canWrite: boolean },
  ): McpServer {
    const server = new McpServer(
      { name: 'nest-demo', version: '0.0.1' },
      {
        instructions:
          'A blog API: posts in categories, with comments, likes and ' +
          'notifications. Each tool that writes needs the same permission as ' +
          'its REST route; get_me lists yours. Posts are drafts until ' +
          'published, and publishing is final.' +
          (canWrite
            ? ''
            : ' You were allowed only to read: tools that write will refuse ' +
              'until the user connects again and allows writing.'),
      },
    );
    if (!canWrite) {
      refuseWrites(server);
    }
    for (const tools of [
      this.postTools,
      this.commentTools,
      this.categoryTools,
      this.notificationTools,
      this.accountTools,
    ]) {
      tools.register(server, user);
    }
    this.prompts.register(server);
    return server;
  }
}

// Registers the tools that are not read-only, by their annotations, with a
// handler that refuses. Listed all the same, so the model can tell the user
// why it cannot write. Unannotated tools count as writing, as MCP assumes.
function refuseWrites(server: McpServer): void {
  const registerTool = server.registerTool.bind(server);
  server.registerTool = ((name, config, callback) =>
    registerTool(
      name,
      config,
      config.annotations?.readOnlyHint
        ? callback
        : (refuse as unknown as typeof callback),
    )) as typeof server.registerTool;
}

function refuse(): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text:
          'You were allowed only to read. To write, the user has to connect ' +
          'again and allow writing.',
      },
    ],
    isError: true,
  };
}
