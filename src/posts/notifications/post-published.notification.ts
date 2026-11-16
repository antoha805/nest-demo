import { Notification } from '../../notifications/notification';
import { QueuedNotification } from '../../notifications/queue/queued-notifications';
import { PublicUser } from '../../users/public-user';
import { Post } from '../post.entity';

export interface PostPublishedData {
  postId: string;
  postTitle: string;
  // Null once the author has been deleted.
  author: PublicUser | null;
}

// Sent to every user but the author when a post is first published. Queued,
// as it goes to everyone.
export class PostPublishedNotification extends Notification<PostPublishedData> {
  static readonly TYPE = 'post.published';

  readonly type = PostPublishedNotification.TYPE;

  constructor(
    private readonly post: Pick<Post, 'id' | 'title'>,
    private readonly author: PublicUser | null,
  ) {
    super();
  }

  // Queued with the post's id: the worker loads the post when it sends.
  static queued(postId: string): QueuedNotification<{ postId: string }> {
    return { type: PostPublishedNotification.TYPE, data: { postId } };
  }

  toDatabase(): PostPublishedData {
    return {
      postId: this.post.id,
      postTitle: this.post.title,
      author: this.author,
    };
  }
}
