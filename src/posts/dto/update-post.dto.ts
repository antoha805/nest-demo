import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Equals, IsOptional } from 'class-validator';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(
  OmitType(CreatePostDto, ['published'] as const),
) {
  // Publishes a draft, which needs posts.publish. Only true, as publishing is
  // final, and a published post stays as it is.
  @IsOptional()
  @Equals(true, {
    message: 'published can only be true, as posts cannot be unpublished',
  })
  published?: true;
}
