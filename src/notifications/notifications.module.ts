import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';
import { BroadcastChannel } from './channels/broadcast.channel';
import { DatabaseChannel } from './channels/database.channel';
import { MailChannel } from './channels/mail.channel';
import { SmsChannel } from './channels/sms.channel';
import { NotificationBroadcaster } from './notification-broadcaster';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import {
  NOTIFICATIONS_QUEUE,
  NotificationQueue,
} from './queue/notification-queue';
import { NotificationsProcessor } from './queue/notifications.processor';
import { QueuedNotifications } from './queue/queued-notifications';

@Module({
  imports: [
    MailModule,
    SmsModule,
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationBroadcaster,
    DatabaseChannel,
    BroadcastChannel,
    MailChannel,
    SmsChannel,
    NotificationQueue,
    NotificationsProcessor,
    QueuedNotifications,
  ],
  exports: [NotificationsService, NotificationQueue, QueuedNotifications],
})
export class NotificationsModule {}
