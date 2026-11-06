import { PaginationQueryDto } from './dto/pagination-query.dto';

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Runs a findAndCount for the requested page, such as with EntityManager.
export async function paginate<T>(
  findAndCount: (page: {
    limit: number;
    offset: number;
  }) => Promise<[T[], number]>,
  { page, limit }: PaginationQueryDto,
): Promise<Paginated<T>> {
  const [data, total] = await findAndCount({
    limit,
    offset: (page - 1) * limit,
  });
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
