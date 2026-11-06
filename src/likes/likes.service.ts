import type { QueryResult } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Like, LikeableType } from './like.entity';

// Callers check that the user can read the record: only they know how.
@Injectable()
export class LikesService {
  constructor(private readonly em: EntityManager) {}

  // Whether the like is new, rather than there already.
  async like(
    likeableType: LikeableType,
    likeableId: string,
    userId: string,
  ): Promise<boolean> {
    const { affectedRows } = await this.em
      .createQueryBuilder(Like)
      .insert({ likeableType, likeableId, userId })
      .onConflict()
      .ignore()
      .execute<QueryResult>('run');
    return affectedRows > 0;
  }

  async unlike(
    likeableType: LikeableType,
    likeableId: string,
    userId: string,
  ): Promise<void> {
    await this.em.nativeDelete(Like, { likeableType, likeableId, userId });
  }

  // When the user liked each of these records, by id. Empty without a user.
  async likedAt(
    likeableType: LikeableType,
    likeableIds: string[],
    userId?: string,
  ): Promise<Map<string, Date>> {
    if (!userId || !likeableIds.length) {
      return new Map();
    }
    const likes = await this.em.find(Like, {
      likeableType,
      likeableId: { $in: likeableIds },
      userId,
    });
    return new Map(likes.map((like) => [like.likeableId, like.createdAt]));
  }
}
