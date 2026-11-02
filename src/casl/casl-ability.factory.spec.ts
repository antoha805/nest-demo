import { AuthenticatedUser } from '../auth/authenticated-user';
import { Comment } from '../comments/comment.entity';
import { Post } from '../posts/post.entity';
import { PERMISSIONS, PERMISSION_NAMES } from '../roles/permission-names';
import { CaslAbilityFactory } from './casl-ability.factory';

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  const abilityFor = (...permissions: string[]) => {
    const user: AuthenticatedUser = {
      id: 'me',
      email: 'me@example.com',
      roles: [],
      permissions,
    };
    return factory.createForUser(user);
  };

  const postBy = (authorId: string | null) =>
    Object.assign(new Post(), { authorId });

  it('allows nothing without permissions', () => {
    const ability = abilityFor();

    expect(ability.can('create', Post)).toBe(false);
    expect(ability.can('update', Post)).toBe(false);
    expect(ability.can('publish', Post)).toBe(false);
  });

  it('limits .own permissions to the author', () => {
    const ability = abilityFor(
      PERMISSIONS.POSTS_UPDATE_OWN,
      PERMISSIONS.POSTS_DELETE_OWN,
    );

    expect(ability.can('update', Post)).toBe(true);
    expect(ability.can('update', postBy('me'))).toBe(true);
    expect(ability.can('delete', postBy('me'))).toBe(true);
    expect(ability.can('update', postBy('other'))).toBe(false);
    expect(ability.can('delete', postBy('other'))).toBe(false);
    expect(ability.can('update', postBy(null))).toBe(false);
  });

  it('applies .all permissions to every post', () => {
    const ability = abilityFor(
      PERMISSIONS.POSTS_UPDATE_ALL,
      PERMISSIONS.POSTS_DELETE_ALL,
    );

    expect(ability.can('update', postBy('other'))).toBe(true);
    expect(ability.can('delete', postBy(null))).toBe(true);
  });

  it('keeps each permission to its own action', () => {
    const ability = abilityFor(PERMISSIONS.POSTS_UPDATE_ALL);

    expect(ability.can('delete', postBy('me'))).toBe(false);
    expect(ability.can('publish', Post)).toBe(false);
  });

  it('limits comment edits to the author, even for moderators', () => {
    const ability = abilityFor(
      PERMISSIONS.COMMENTS_UPDATE_OWN,
      PERMISSIONS.COMMENTS_DELETE_ALL,
    );
    const commentBy = (authorId: string | null) =>
      Object.assign(new Comment(), { authorId });

    expect(ability.can('update', commentBy('me'))).toBe(true);
    expect(ability.can('update', commentBy('other'))).toBe(false);
    expect(ability.can('delete', commentBy('other'))).toBe(true);
    expect(ability.can('delete', commentBy(null))).toBe(true);
  });

  it('keeps liking posts and comments separate', () => {
    const ability = abilityFor(PERMISSIONS.POSTS_LIKE);

    expect(ability.can('like', Post)).toBe(true);
    expect(ability.can('like', Comment)).toBe(false);
  });

  it('ignores names missing from the code', () => {
    expect(abilityFor('posts.update').can('update', Post)).toBe(false);
  });

  it('gives rules to every permission', () => {
    expect(abilityFor(...PERMISSION_NAMES).rules).toHaveLength(
      PERMISSION_NAMES.length + 3,
    );
  });
});
