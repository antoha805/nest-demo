import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

  // A server for one request, acting as its user, or anonymously without one.
  create(user?: AuthenticatedUser): McpServer {
    const server = new McpServer(
      { name: 'nest-demo', version: '0.0.1' },
      {
        instructions:
          'A blog API: posts in categories, with comments, likes and ' +
          'notifications. Anyone can read published posts. Writing needs a ' +
          'bearer token, and each tool needs the same permission as its REST ' +
          'route; get_me lists yours. Posts are drafts until published, and ' +
          'publishing is final.',
      },
    );
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
