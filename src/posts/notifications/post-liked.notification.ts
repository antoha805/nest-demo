import { AuthenticatedUser } from '../../auth/authenticated-user';
import { Notification } from '../../notifications/notification';
import { Post } from '../post.entity';

export interface PostLikedData {
  postId: string;
  postTitle: string;
  // Only the nickname, so the email stays private.
  liker: { id: string; nickname: string };
}

// Sent to the author of a post that someone else liked.
export class PostLikedNotification extends Notification<PostLikedData> {
  readonly type = 'post.liked';

  constructor(
    private readonly post: Post,
    private readonly liker: AuthenticatedUser,
  ) {
    super();
  }

  toDatabase(): PostLikedData {
    return {
      postId: this.post.id,
      postTitle: this.post.title,
      liker: { id: this.liker.id, nickname: this.liker.nickname },
    };
  }
}
