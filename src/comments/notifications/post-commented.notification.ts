import { AuthenticatedUser } from '../../auth/authenticated-user';
import { MailMessage } from '../../notifications/messages/mail-message';
import {
  MailRecipient,
  Notification,
  NotificationChannelName,
} from '../../notifications/notification';
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

  via(): NotificationChannelName[] {
    return ['database', 'broadcast', 'mail'];
  }

  toDatabase(): PostCommentedData {
    return {
      postId: this.post.id,
      postTitle: this.post.title,
      commentId: this.comment.id,
      commenter: toPublicUser(this.commenter),
    };
  }

  toMail(user: MailRecipient): MailMessage {
    return new MailMessage()
      .subject(`New comment on "${this.post.title}"`)
      .greeting(`Hi ${user.nickname}!`)
      .line(
        `${this.commenter.nickname} commented on your post "${this.post.title}":`,
      )
      .line(excerpt(this.comment.content))
      .action('View the post', `/posts/${this.post.id}`);
  }
}

// Long comments are cut, so the mail stays short and links to the rest.
export const EXCERPT_LENGTH = 200;

function excerpt(content: string): string {
  const text = content.replace(/\s+/g, ' ').trim();
  return text.length > EXCERPT_LENGTH
    ? `${text.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…`
    : text;
}
