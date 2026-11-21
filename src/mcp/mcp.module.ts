import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CaslModule } from '../casl/casl.module';
import { CategoriesModule } from '../categories/categories.module';
import { CommentsModule } from '../comments/comments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsModule } from '../posts/posts.module';
import { McpServerFactory } from './mcp-server.factory';
import { McpToolkit } from './mcp-toolkit';
import { McpController } from './mcp.controller';
import { McpPrompts } from './prompts';
import { AccountTools } from './tools/account.tools';
import { CategoryTools } from './tools/category.tools';
import { CommentTools } from './tools/comment.tools';
import { NotificationTools } from './tools/notification.tools';
import { PostTools } from './tools/post.tools';

@Module({
  imports: [
    AuthModule,
    CaslModule,
    CategoriesModule,
    CommentsModule,
    NotificationsModule,
    PostsModule,
  ],
  controllers: [McpController],
  providers: [
    McpServerFactory,
    McpToolkit,
    McpPrompts,
    PostTools,
    CommentTools,
    CategoryTools,
    NotificationTools,
    AccountTools,
  ],
})
export class McpModule {}
