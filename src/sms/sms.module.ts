import { Module } from '@nestjs/common';
import { SmsSender } from './sms-sender';

@Module({
  providers: [SmsSender],
  exports: [SmsSender],
})
export class SmsModule {}
