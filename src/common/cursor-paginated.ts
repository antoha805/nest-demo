import { SelectQueryBuilder } from 'typeorm';
import { CursorPaginationQueryDto } from './dto/cursor-pagination-query.dto';

export interface CursorPaginated<T> {
  data: T[];
  limit: number;
  nextCursor: string | null;
}

// Pages by id, which is a UUID v7 and so sorts oldest first. Unlike an offset,
// records added or deleted between requests cannot shift the next page.
export async function cursorPaginate<T extends { id: string }>(
  query: SelectQueryBuilder<T>,
  { after, limit }: CursorPaginationQueryDto,
): Promise<CursorPaginated<T>> {
  if (after) {
    query.andWhere(`${query.alias}.id > :after`, { after });
  }
  // One extra row shows if there is a next page, without counting them all.
  const rows = await query
    .orderBy(`${query.alias}.id`, 'ASC')
    .limit(limit + 1)
    .getMany();
  const data = rows.slice(0, limit);

  return {
    data,
    limit,
    nextCursor: rows.length > limit ? data[data.length - 1].id : null,
  };
}
