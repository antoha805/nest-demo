import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

// The only way to select likedByMeAt, as its subquery needs this parameter.
// Without a user the subquery matches nothing, which gives null.
export function selectLikedByMeAt<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  userId?: string,
): SelectQueryBuilder<T> {
  return query
    .addSelect(`${query.alias}.likedByMeAt`)
    .setParameter('likedByUserId', userId ?? null);
}
