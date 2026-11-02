import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { Category } from '../categories/category.entity';
import { Comment } from '../comments/comment.entity';
import { Post } from '../posts/post.entity';
import { PermissionName } from '../roles/permission-names';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';

type Action = 'create' | 'read' | 'update' | 'delete' | 'publish' | 'like';
type Subjects = InferSubjects<
  typeof Category | typeof Comment | typeof Post | typeof Role | typeof User
>;

export type AppAbility = MongoAbility<[Action, Subjects]>;

type Can = AbilityBuilder<AppAbility>['can'];

// A Record, so a permission without rules is a compile error.
const PERMISSION_RULES: Record<
  PermissionName,
  (can: Can, user: AuthenticatedUser) => void
> = {
  'categories.create': (can) => can('create', Category),
  'categories.update': (can) => can('update', Category),
  'categories.delete': (can) => can('delete', Category),
  'posts.create': (can) => can('create', Post),
  'posts.update.all': (can) => can('update', Post),
  'posts.update.own': (can, user) => can('update', Post, { authorId: user.id }),
  'posts.delete.all': (can) => can('delete', Post),
  'posts.delete.own': (can, user) => can('delete', Post, { authorId: user.id }),
  'posts.publish': (can) => can('publish', Post),
  'posts.like': (can) => can('like', Post),
  'comments.create': (can) => can('create', Comment),
  'comments.update.own': (can, user) =>
    can('update', Comment, { authorId: user.id }),
  'comments.delete.all': (can) => can('delete', Comment),
  'comments.delete.own': (can, user) =>
    can('delete', Comment, { authorId: user.id }),
  'comments.like': (can) => can('like', Comment),
  'users.read': (can) => can('read', User),
  'users.manage': (can) => {
    can('update', User);
    can('delete', User);
  },
  'roles.read': (can) => can('read', Role),
  'roles.manage': (can) => {
    can('create', Role);
    can('update', Role);
    can('delete', Role);
  },
};

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: AuthenticatedUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    for (const name of user.permissions) {
      // The database can hold names that were since removed from the code.
      PERMISSION_RULES[name as PermissionName]?.(can, user);
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
