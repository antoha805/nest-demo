import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  // Publishes it at once, which needs posts.publish. A draft otherwise.
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsUUID()
  categoryId: string;
}
