import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { type QueryResult, raw } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { Mailer } from '../mail/mailer';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/user.entity';
import { AuthenticatedUser } from './authenticated-user';
import { EmailVerification } from './email-verification.entity';
import { VerifyEmailNotification } from './notifications/verify-email.notification';

export const CODE_VALID_MINUTES = 15;
// Wrong codes allowed per code: with a million possible codes, guessing one
// in this many tries is unlikely.
export const MAX_ATTEMPTS = 5;
// So the resend endpoint cannot flood someone's inbox.
export const RESEND_COOLDOWN_SECONDS = 60;

// Confirms that new users own their email, with a 6-digit code mailed to it.
@Injectable()
export class EmailVerificationService {
  private readonly secret: string;

  constructor(
    private readonly em: EntityManager,
    private readonly notificationsService: NotificationsService,
    private readonly mailer: Mailer,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.secret = config.get('JWT_SECRET', { infer: true });
  }

  // For a user who just registered. With mail off no code could arrive, so
  // they are confirmed straight away.
  async start(userId: string): Promise<void> {
    if (!this.mailer.enabled) {
      await this.markVerified(userId);
      return;
    }
    await this.sendCode(userId);
  }

  async resend(user: AuthenticatedUser): Promise<void> {
    if (user.emailVerifiedAt) {
      throw new ConflictException('Your email is already confirmed');
    }
    // Such as when mail was turned off since they registered.
    if (!this.mailer.enabled) {
      await this.markVerified(user.id);
      return;
    }
    const pending = await this.em.findOne(EmailVerification, {
      userId: user.id,
    });
    const waitMs = pending
      ? pending.sentAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()
      : 0;
    if (waitMs > 0) {
      throw new HttpException(
        `Wait ${Math.ceil(waitMs / 1000)} seconds before requesting a new code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.sendCode(user.id);
  }

  // Does nothing once the email is confirmed, so a repeated request is fine.
  async verify(user: AuthenticatedUser, code: string): Promise<void> {
    if (user.emailVerifiedAt) {
      return;
    }
    // Counts the try before checking it, in one statement, so tries sent in
    // parallel cannot go past the limit.
    const { affectedRows } = await this.em
      .createQueryBuilder(EmailVerification)
      .update({ attempts: raw('"attempts" + 1') })
      .where({
        userId: user.id,
        attempts: { $lt: MAX_ATTEMPTS },
        expiresAt: { $gt: new Date() },
      })
      .execute<QueryResult>('run');
    if (!affectedRows) {
      throw new BadRequestException(
        'The code has expired or was tried too often. Request a new one',
      );
    }

    const { codeHash } = await this.em.findOneOrFail(
      EmailVerification,
      { userId: user.id },
      { refresh: true },
    );
    if (!this.matches(codeHash, user.id, code)) {
      throw new BadRequestException('The code is wrong');
    }
    await this.markVerified(user.id);
  }

  private async sendCode(userId: string): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const sentAt = new Date();
    // Replaces any earlier code, which stops working.
    await this.em.upsert(EmailVerification, {
      userId,
      codeHash: this.hash(userId, code),
      attempts: 0,
      expiresAt: new Date(sentAt.getTime() + CODE_VALID_MINUTES * 60_000),
      sentAt,
    });
    await this.notificationsService.send(
      userId,
      new VerifyEmailNotification(code, CODE_VALID_MINUTES),
    );
  }

  private async markVerified(userId: string): Promise<void> {
    await this.em.transactional(async (em) => {
      await em.nativeUpdate(
        User,
        { id: userId },
        { emailVerifiedAt: new Date() },
      );
      await em.nativeDelete(EmailVerification, { userId });
    });
  }

  // Bound to the user, so a code only works for the account it was sent to.
  private hash(userId: string, code: string): string {
    return createHmac('sha256', this.secret)
      .update(`${userId}:${code}`)
      .digest('hex');
  }

  private matches(codeHash: string, userId: string, code: string): boolean {
    return timingSafeEqual(
      Buffer.from(codeHash, 'hex'),
      Buffer.from(this.hash(userId, code), 'hex'),
    );
  }
}
