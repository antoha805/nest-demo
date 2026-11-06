import { AuthenticatedUser } from '../../auth/authenticated-user';
import { Notification } from '../../notifications/notification';
import { Post } from '../../posts/post.entity';
import { PublicUser, toPublicUser } from '../../users/public-user';
import { Comment } from '../comment.entity';

export interface CommentLikedData {
  commentId: string;
  postId: string;
  postTitle: string;
  liker: PublicUser;
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
      liker: toPublicUser(this.liker),
    };
  }
}
