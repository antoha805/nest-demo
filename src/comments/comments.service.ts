import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginated, Paginated, paginationOptions } from '../common/paginated';
import { LikeableType } from '../likes/like.entity';
import { LikesService } from '../likes/likes.service';
import { PostsService } from '../posts/posts.service';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly postsService: PostsService,
    private readonly likesService: LikesService,
  ) {}

  async create(
    postId: string,
    dto: CreateCommentDto,
    user: AuthenticatedUser,
  ): Promise<Comment> {
    await this.postsService.findVisible(postId, user);
    const { id } = await this.commentsRepository.save(
      this.commentsRepository.create({ ...dto, postId, authorId: user.id }),
    );
    return this.withLikedByMeAt(await this.findOne(id), user.id);
  }

  async findAllForPost(
    postId: string,
    query: PaginationQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<Comment>> {
    await this.postsService.findVisible(postId, user);
    const [comments, total] = await this.commentsRepository.findAndCount({
      where: { postId },
      // The id keeps pages stable when comments share a timestamp.
      order: { createdAt: 'ASC', id: 'ASC' },
      ...paginationOptions(query),
    });
    await this.likesService.withLikedByMeAt(
      LikeableType.COMMENT,
      comments,
      user?.id,
    );
    return paginated(comments, total, query);
  }

  // A comment is only as visible as its post, so drafts do not leak through it.
  async findVisible(id: string, user: AuthenticatedUser): Promise<Comment> {
    const comment = await this.findOne(id);
    await this.postsService.findVisible(comment.postId, user);
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
    return this.withLikedByMeAt(await this.findOne(id), userId);
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

  private async withLikedByMeAt(
    comment: Comment,
    userId: string,
  ): Promise<Comment> {
    const [result] = await this.likesService.withLikedByMeAt(
      LikeableType.COMMENT,
      [comment],
      userId,
    );
    return result;
  }

  private findOne(id: string): Promise<Comment> {
    return this.commentsRepository.findOneByOrFail({ id });
  }
}
