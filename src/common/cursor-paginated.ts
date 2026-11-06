import { CursorPaginationQueryDto } from './dto/cursor-pagination-query.dto';

export interface CursorPaginated<T> {
  data: T[];
  limit: number;
  nextCursor: string | null;
}

export interface CursorPage {
  // Only ids below this one, when set.
  before?: string;
  limit: number;
}

// Pages newest first by id, which is a UUID v7 and so sorts by time. Unlike an
// offset, records added or deleted between requests cannot shift the next page.
// find has to order by id descending and apply the page.
export async function cursorPaginate<T extends { id: string }>(
  find: (page: CursorPage) => Promise<T[]>,
  { after, limit }: CursorPaginationQueryDto,
): Promise<CursorPaginated<T>> {
  // One extra row shows if there is a next page, without counting them all.
  const rows = await find({ before: after, limit: limit + 1 });
  const data = rows.slice(0, limit);

  return {
    data,
    limit,
    nextCursor: rows.length > limit ? data[data.length - 1].id : null,
  };
}
