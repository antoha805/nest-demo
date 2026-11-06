import { Transform } from 'class-transformer';
import { Length, Matches } from 'class-validator';
import { CredentialsDto } from './credentials.dto';

export class RegisterDto extends CredentialsDto {
  // Lowercased like the email, so names differing only in case cannot coexist.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Length(3, 30)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'nickname may only contain letters, digits and underscores',
  })
  nickname: string;
}
