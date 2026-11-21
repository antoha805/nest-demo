import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { PostsModule } from '../posts/posts.module';
import { McpServerFactory } from './mcp-server.factory';
import { McpController } from './mcp.controller';

@Module({
  imports: [CategoriesModule, PostsModule],
  controllers: [McpController],
  providers: [McpServerFactory],
})
export class McpModule {}
