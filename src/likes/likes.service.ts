import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Like, LikeableType } from './like.entity';

// Callers check that the user can read the record: only they know how.
@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
  ) {}

  async like(
    likeableType: LikeableType,
    likeableId: string,
    userId: string,
  ): Promise<void> {
    await this.likesRepository
      .createQueryBuilder()
      .insert()
      .values({ likeableType, likeableId, userId })
      .orIgnore()
      .execute();
  }

  async unlike(
    likeableType: LikeableType,
    likeableId: string,
    userId: string,
  ): Promise<void> {
    await this.likesRepository.delete({ likeableType, likeableId, userId });
  }

  // Depends on the user, so unlike likesCount it cannot be a virtual column.
  async withLikedByMeAt<T extends { id: string; likedByMeAt: Date | null }>(
    likeableType: LikeableType,
    records: T[],
    userId?: string,
  ): Promise<T[]> {
    const likes =
      userId && records.length
        ? await this.likesRepository.findBy({
            likeableType,
            likeableId: In(records.map(({ id }) => id)),
            userId,
          })
        : [];
    const likedAt = new Map(likes.map((l) => [l.likeableId, l.createdAt]));

    for (const record of records) {
      record.likedByMeAt = likedAt.get(record.id) ?? null;
    }
    return records;
  }
}
