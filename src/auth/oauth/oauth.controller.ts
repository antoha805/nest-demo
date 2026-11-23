import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from '../auth.service';
import { Public } from '../decorators/public.decorator';
import { sendConsentPage, sendErrorPage } from './consent-page';
import { ConsentDto } from './consent.dto';
import { OAuthProvider } from './oauth.provider';
import { MCP_WRITE_SCOPE } from './oauth-urls';

// Where the consent page /authorize shows is sent. The other OAuth endpoints
// are the MCP SDK's, at the root: see configureApp.
@Public()
@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthProvider: OAuthProvider,
  ) {}

  // Limited per IP, as it checks passwords, like POST /api/auth/login.
  @UseGuards(ThrottlerGuard)
  @Post('consent')
  async consent(@Body() dto: ConsentDto, @Res() res: Response): Promise<void> {
    const pending = await this.oauthProvider.readConsentRequest(dto.request);
    if (!pending) {
      return sendErrorPage(
        res,
        HttpStatus.BAD_REQUEST,
        'This page has expired. Go back to the app and connect again.',
      );
    }
    const { request, client } = pending;
    if (dto.decision === 'deny') {
      return res.redirect(
        HttpStatus.SEE_OTHER,
        this.oauthProvider.deny(request),
      );
    }

    const userId = await this.authService.checkCredentials({
      email: dto.email ?? '',
      password: dto.password ?? '',
    });
    if (!userId) {
      return sendConsentPage(
        res,
        {
          clientName: client.client_name,
          redirectUri: request.redirectUri,
          requestToken: dto.request,
          writeRequested: request.scope.includes(MCP_WRITE_SCOPE),
          email: dto.email,
          error: 'Invalid email or password',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    res.redirect(
      HttpStatus.SEE_OTHER,
      await this.oauthProvider.approve(request, userId, dto.write === 'on'),
    );
  }
}
