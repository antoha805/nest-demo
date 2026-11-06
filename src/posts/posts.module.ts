import { Module } from '@nestjs/common';
import { CaslModule } from '../casl/casl.module';
import { CategoriesModule } from '../categories/categories.module';
import { CommentsModule } from '../comments/comments.module';
import { LikesModule } from '../likes/likes.module';
import { PostVisibilityModule } from './post-visibility.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [
    CategoriesModule,
    CaslModule,
    LikesModule,
    CommentsModule,
    PostVisibilityModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
