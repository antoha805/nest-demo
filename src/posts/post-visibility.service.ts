import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { Post } from './post.entity';

// Separate from PostsService so comments can use it while posts use comments.
@Injectable()
export class PostVisibilityService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  findVisible(id: string, user?: AuthenticatedUser): Promise<Post> {
    return this.postsRepository.findOneOrFail({
      where: this.visibleWhere(user).map((where) => ({ ...where, id })),
    });
  }

  visibleWhere(user?: AuthenticatedUser): FindOptionsWhere<Post>[] {
    if (!user) {
      return [{ published: true }];
    }
    // Publishers have to see drafts in order to review them.
    return this.caslAbilityFactory.createForUser(user).can('publish', Post)
      ? [{}]
      : [{ published: true }, { authorId: user.id }];
  }
}
