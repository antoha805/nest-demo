import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { QueuedNotifications } from '../../notifications/queue/queued-notifications';
import { toPublicUser } from '../../users/public-user';
import { User } from '../../users/user.entity';
import { Post } from '../post.entity';
import { PostPublishedNotification } from './post-published.notification';

// Makes PostPublishedNotification again when its queued jobs run.
@Injectable()
export class PostPublishedNotificationFactory implements OnModuleInit {
  constructor(
    private readonly em: EntityManager,
    private readonly queuedNotifications: QueuedNotifications,
  ) {}

  onModuleInit(): void {
    this.queuedNotifications.register<{ postId: string }>(
      PostPublishedNotification.TYPE,
      (data) => this.make(data),
    );
  }

  // Null once the post has been deleted, so it is not
  // announced any more.
  async make({
    postId,
  }: {
    postId: string;
  }): Promise<PostPublishedNotification | null> {
    const em = this.em.fork();
    const post = await em.findOne(
      Post,
      { id: postId, publishedAt: { $ne: null } },
      { fields: ['id', 'title', 'authorId'] },
    );
    if (!post) {
      return null;
    }
    const author = post.authorId
      ? await em.findOne(User, post.authorId, { fields: ['id', 'nickname'] })
      : null;
    return new PostPublishedNotification(post, author && toPublicUser(author));
  }
}
