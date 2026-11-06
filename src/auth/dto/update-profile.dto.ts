import { PickType } from '@nestjs/mapped-types';
import { RegisterDto } from './register.dto';

// Only what users may change about themselves. The email stays fixed.
export class UpdateProfileDto extends PickType(RegisterDto, ['nickname']) {}
