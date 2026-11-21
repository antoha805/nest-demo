import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from '../../auth/auth.service';
import { AuthenticatedUser } from '../../auth/authenticated-user';
import { UpdateProfileDto } from '../../auth/dto/update-profile.dto';
import { VerifyEmailDto } from '../../auth/dto/verify-email.dto';
import { EmailVerificationService } from '../../auth/email-verification.service';
import { McpToolkit, READ_ONLY, WRITE } from '../mcp-toolkit';

// The user's own account. Logging in and registering stay REST only, as a
// client sends the token from its configuration, not one a tool returns.
@Injectable()
export class AccountTools {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly toolkit: McpToolkit,
  ) {}

  register(server: McpServer, user?: AuthenticatedUser): void {
    const { toolkit, authService, emailVerificationService } = this;

    server.registerTool(
      'get_me',
      {
        title: 'Get your account',
        description:
          'Gets your account: nickname, roles, permissions, whether your email ' +
          'is confirmed, and your unread notifications count. Until the email ' +
          'is confirmed you have no permissions, so cannot write.',
        annotations: READ_ONLY,
      },
      () => toolkit.run(() => authService.me(toolkit.requireUser(user))),
    );

    server.registerTool(
      'update_me',
      {
        title: 'Update your account',
        description:
          'Changes your nickname or phone. Give at least one. A null phone removes it.',
        inputSchema: {
          nickname: z
            .string()
            .optional()
            .describe('3 to 30 letters, digits or underscores.'),
          phone: z
            .string()
            .nullable()
            .optional()
            .describe('In international format, such as +4915112345678.'),
        },
        annotations: WRITE,
      },
      (args) =>
        toolkit.run(async () =>
          authService.updateProfile(
            toolkit.requireUser(user).id,
            await toolkit.validate(UpdateProfileDto, args),
          ),
        ),
    );

    server.registerTool(
      'verify_email',
      {
        title: 'Confirm your email',
        description:
          'Confirms your email with the 6-digit code mailed to you. A code ' +
          'expires after 15 minutes and stops working after 5 wrong tries.',
        inputSchema: { code: z.string().describe('The 6-digit code.') },
        annotations: WRITE,
      },
      (args) =>
        toolkit.run(async () => {
          const current = toolkit.requireUser(user);
          const { code } = await toolkit.validate(VerifyEmailDto, args);
          await emailVerificationService.verify(current, code);
        }, 'Email confirmed'),
    );

    server.registerTool(
      'resend_verification_code',
      {
        title: 'Resend the email code',
        description:
          'Mails a new confirmation code, which replaces the old one. At most once a minute.',
        annotations: WRITE,
      },
      () =>
        toolkit.run(
          () => emailVerificationService.resend(toolkit.requireUser(user)),
          'A new code was mailed',
        ),
    );
  }
}
