import { Module } from '@nestjs/common';
import { CaslModule } from '../casl/casl.module';
import { LikesModule } from '../likes/likes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostVisibilityModule } from '../posts/post-visibility.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [PostVisibilityModule, CaslModule, LikesModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
