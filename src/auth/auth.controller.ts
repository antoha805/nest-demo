import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './authenticated-user';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CredentialsDto } from './dto/credentials.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: CredentialsDto) {
    return this.authService.login(dto);
  }

  // With the unread count, for a notification badge when the client starts.
  // The stream sends it again on each connection.
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  // Confirms the email with the code mailed on registration. Also limited per
  // IP, on top of the tries each code allows.
  @UseGuards(ThrottlerGuard)
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  verifyEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() { code }: VerifyEmailDto,
  ) {
    return this.emailVerificationService.verify(user, code);
  }

  @Post('verify-email/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  resendVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.emailVerificationService.resend(user);
  }

  // Any signed-in user can change their own profile, so no permission is needed.
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }
}
