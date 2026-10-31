import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, MaxLength } from 'class-validator';

export class CredentialsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  // bcrypt silently ignores everything after the first 72 bytes.
  @IsString()
  @IsByteLength(8, 72)
  password: string;
}
