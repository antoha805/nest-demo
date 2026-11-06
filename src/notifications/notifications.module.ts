import { Module } from '@nestjs/common';
import { BroadcastChannel } from './channels/broadcast.channel';
import { DatabaseChannel } from './channels/database.channel';
import { NotificationBroadcaster } from './notification-broadcaster';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationBroadcaster,
    DatabaseChannel,
    BroadcastChannel,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
