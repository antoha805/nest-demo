import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { Like, LikeableType } from './like.entity';

const MY_LIKE = 'myLike';

// Depends on the user, so unlike likesCount it cannot be a virtual column.
// Matches at most one row, as the three columns are the primary key of likes.
export function joinMyLike<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  likeableType: LikeableType,
  userId?: string,
): SelectQueryBuilder<T> {
  if (!userId) {
    return query;
  }
  return query.leftJoinAndMapOne(
    `${query.alias}.${MY_LIKE}`,
    Like,
    MY_LIKE,
    `${MY_LIKE}.likeableType = :myLikeType AND ${MY_LIKE}.likeableId = ${query.alias}.id AND ${MY_LIKE}.userId = :myLikeUserId`,
    { myLikeType: likeableType, myLikeUserId: userId },
  );
}

// Call on the results of a query that went through joinMyLike.
export function setLikedByMeAt<T extends { likedByMeAt: Date | null }>(
  records: T[],
): T[] {
  for (const record of records as (T & { [MY_LIKE]?: Like })[]) {
    record.likedByMeAt = record[MY_LIKE]?.createdAt ?? null;
    delete record[MY_LIKE];
  }
  return records;
}
