import { PartialType, PickType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';
import { RegisterDto } from './register.dto';

// Only what users may change about themselves. The email stays fixed. Each
// field is optional, but at least one is needed.
export class UpdateProfileDto extends PartialType(
  PickType(RegisterDto, ['nickname']),
) {
  // In E.164, such as +4915112345678, for SMS notifications. Spaces, dashes,
  // dots and parentheses are dropped, so "+49 (151) 123-45678" works too. Null
  // removes it.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s().-]/g, '') : value,
  )
  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be in international format, such as +4915112345678',
  })
  phone?: string | null;
}
