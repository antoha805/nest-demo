import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

// New posts are drafts: they are published with PUT /posts/:id/publish.
export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsUUID()
  categoryId: string;
}
