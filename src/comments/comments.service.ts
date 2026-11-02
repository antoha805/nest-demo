import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { cursorPaginate, CursorPaginated } from '../common/cursor-paginated';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto';
import { LikeableType } from '../likes/like.entity';
import { LikesService } from '../likes/likes.service';
import { PostVisibilityService } from '../posts/post-visibility.service';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly postVisibilityService: PostVisibilityService,
    private readonly likesService: LikesService,
  ) {}

  async create(
    postId: string,
    dto: CreateCommentDto,
    user: AuthenticatedUser,
  ): Promise<Comment> {
    await this.postVisibilityService.findVisible(postId, user);
    const { id } = await this.commentsRepository.save(
      this.commentsRepository.create({ ...dto, postId, authorId: user.id }),
    );
    return this.findOneForUser(id, user.id);
  }

  async findAllForPost(
    postId: string,
    query: CursorPaginationQueryDto,
    user?: AuthenticatedUser,
  ): Promise<CursorPaginated<Comment>> {
    await this.postVisibilityService.findVisible(postId, user);
    return this.findPageForPost(postId, query, user?.id);
  }

  // The caller has to check that the user can read the post.
  findPageForPost(
    postId: string,
    query: CursorPaginationQueryDto,
    userId?: string,
  ): Promise<CursorPaginated<Comment>> {
    return cursorPaginate(
      this.queryForUser({ where: { postId } }, userId),
      query,
    );
  }

  // A comment is only as visible as its post, so drafts do not leak through it.
  async findVisible(id: string, user: AuthenticatedUser): Promise<Comment> {
    const comment = await this.findOne(id);
    await this.postVisibilityService.findVisible(comment.postId, user);
    return comment;
  }

  async update(
    id: string,
    dto: UpdateCommentDto,
    userId: string,
  ): Promise<Comment> {
    const comment = await this.commentsRepository.preload({ id, ...dto });
    if (!comment) {
      throw new NotFoundException(`Comment ${id} not found`);
    }
    await this.commentsRepository.save(comment);
    return this.findOneForUser(id, userId);
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.commentsRepository.delete(id);
    if (!affected) {
      throw new NotFoundException(`Comment ${id} not found`);
    }
  }

  async like(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findVisible(id, user);
    await this.likesService.like(LikeableType.COMMENT, id, user.id);
  }

  async unlike(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findVisible(id, user);
    await this.likesService.unlike(LikeableType.COMMENT, id, user.id);
  }

  private queryForUser(options: FindManyOptions<Comment>, userId?: string) {
    return (
      this.commentsRepository
        .createQueryBuilder('comment')
        .setFindOptions(options)
        .addSelect('comment.myLikeAt')
        // Without a user the subquery matches nothing, which gives null.
        .setParameter('myLikeUserId', userId ?? null)
    );
  }

  private findOneForUser(id: string, userId: string): Promise<Comment> {
    return this.queryForUser({ where: { id } }, userId).getOneOrFail();
  }

  private findOne(id: string): Promise<Comment> {
    return this.commentsRepository.findOneByOrFail({ id });
  }
}
