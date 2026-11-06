// What other users may see of a user, such as the author of a comment. Never
// the email, which stays private.
export interface PublicUser {
  id: string;
  nickname: string;
}

// Takes a User or an AuthenticatedUser.
export function toPublicUser({ id, nickname }: PublicUser): PublicUser {
  return { id, nickname };
}
