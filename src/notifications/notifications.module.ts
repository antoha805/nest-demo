import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { BroadcastChannel } from './channels/broadcast.channel';
import { DatabaseChannel } from './channels/database.channel';
import { MailChannel } from './channels/mail.channel';
import { NotificationBroadcaster } from './notification-broadcaster';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [MailModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationBroadcaster,
    DatabaseChannel,
    BroadcastChannel,
    MailChannel,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
