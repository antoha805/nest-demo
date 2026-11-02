import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
