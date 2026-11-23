import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// The consent page's form. Email and password are optional, as declining
// needs neither; a wrong or missing one shows the page again.
export class ConsentDto {
  // The signed authorization request the page was shown for.
  @IsString()
  @MaxLength(4096)
  request: string;

  @IsIn(['allow', 'deny'])
  decision: 'allow' | 'deny';

  // Normalized as in CredentialsDto.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @IsByteLength(0, 72)
  password?: string;

  // Present when the user left writing ticked.
  @IsOptional()
  @IsIn(['on'])
  write?: 'on';
}
