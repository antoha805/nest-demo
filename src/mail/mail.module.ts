import { Module } from '@nestjs/common';
import { Mailer } from './mailer';

@Module({
  providers: [Mailer],
  exports: [Mailer],
})
export class MailModule {}
