import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindPostsQueryDto extends PaginationQueryDto {
  // Searches the titles and contents, in the syntax of web search engines:
  // "a phrase", -excluded, or. A blank one lists all posts, as without it.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
