import { ObjectQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { Post } from './post.entity';

// Separate from PostsService so comments can use it while posts use comments.
@Injectable()
export class PostVisibilityService {
  constructor(
    private readonly em: EntityManager,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  findVisible(id: string, user?: AuthenticatedUser): Promise<Post> {
    return this.em.findOneOrFail(Post, { ...this.visibleWhere(user), id });
  }

  visibleWhere(user?: AuthenticatedUser): ObjectQuery<Post> {
    if (!user) {
      return { published: true };
    }
    // Publishers have to see drafts in order to review them.
    return this.caslAbilityFactory.createForUser(user).can('publish', Post)
      ? {}
      : { $or: [{ published: true }, { authorId: user.id }] };
  }
}
