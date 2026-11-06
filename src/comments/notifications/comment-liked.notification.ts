import { AuthenticatedUser } from '../../auth/authenticated-user';
import { Notification } from '../../notifications/notification';
import { Post } from '../../posts/post.entity';
import { Comment } from '../comment.entity';

export interface CommentLikedData {
  commentId: string;
  postId: string;
  postTitle: string;
  // Only the nickname, so the email stays private.
  liker: { id: string; nickname: string };
}

// Sent to the author of a comment that someone else liked.
export class CommentLikedNotification extends Notification<CommentLikedData> {
  readonly type = 'comment.liked';

  constructor(
    private readonly comment: Comment,
    private readonly post: Post,
    private readonly liker: AuthenticatedUser,
  ) {
    super();
  }

  toDatabase(): CommentLikedData {
    return {
      commentId: this.comment.id,
      postId: this.post.id,
      postTitle: this.post.title,
      liker: { id: this.liker.id, nickname: this.liker.nickname },
    };
  }
}
