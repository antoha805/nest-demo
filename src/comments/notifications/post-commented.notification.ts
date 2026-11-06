import { AuthenticatedUser } from '../../auth/authenticated-user';
import { Notification } from '../../notifications/notification';
import { Post } from '../../posts/post.entity';
import { PublicUser, toPublicUser } from '../../users/public-user';
import { Comment } from '../comment.entity';

export interface PostCommentedData {
  postId: string;
  postTitle: string;
  commentId: string;
  commenter: PublicUser;
}

// Sent to the author of a post that someone else commented on.
export class PostCommentedNotification extends Notification<PostCommentedData> {
  readonly type = 'post.commented';

  constructor(
    private readonly post: Post,
    private readonly comment: Comment,
    private readonly commenter: AuthenticatedUser,
  ) {
    super();
  }

  toDatabase(): PostCommentedData {
    return {
      postId: this.post.id,
      postTitle: this.post.title,
      commentId: this.comment.id,
      commenter: toPublicUser(this.commenter),
    };
  }
}
