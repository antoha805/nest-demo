import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PaginationQueryDto } from './dto/pagination-query.dto';

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Uses LIMIT, as TypeORM's take runs an extra query for the ids when there are
// joins. That query exists for to-many joins, so do not use this with them.
export async function paginate<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  { page, limit }: PaginationQueryDto,
): Promise<Paginated<T>> {
  const [data, total] = await query
    .offset((page - 1) * limit)
    .limit(limit)
    .getManyAndCount();
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
