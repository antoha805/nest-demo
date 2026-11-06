import { randomUUIDv7 } from 'node:crypto';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Observable } from 'rxjs';
import { cursorPaginate, CursorPaginated } from '../common/cursor-paginated';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto';
import { BroadcastChannel } from './channels/broadcast.channel';
import { DatabaseChannel } from './channels/database.channel';
import {
  NotificationChannel,
  NotificationDelivery,
} from './channels/notification-channel';
import { DatabaseNotification } from './database-notification.entity';
import { Notification, NotificationChannelName } from './notification';
import {
  BroadcastNotification,
  NotificationBroadcaster,
} from './notification-broadcaster';

// At most this many missed notifications are replayed to a stream, the newest.
// Clients can list the rest.
export const MAX_REPLAYED = 100;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // In the order they run: a broadcast names the stored notification, so the
  // database comes first.
  private readonly channels: [NotificationChannelName, NotificationChannel][];

  constructor(
    private readonly em: EntityManager,
    private readonly broadcaster: NotificationBroadcaster,
    databaseChannel: DatabaseChannel,
    broadcastChannel: BroadcastChannel,
  ) {
    this.channels = [
      ['database', databaseChannel],
      ['broadcast', broadcastChannel],
    ];
  }

  // Sent after the change it is about has been saved, so a failure is logged
  // rather than failing the request. It also stops the later channels, which
  // could otherwise name a notification that was not stored.
  async send(
    userIds: string | string[],
    notification: Notification,
  ): Promise<void> {
    const createdAt = new Date();
    const deliveries = [...new Set([userIds].flat())].map(
      (userId): NotificationDelivery => ({
        id: randomUUIDv7(),
        userId,
        notification,
        createdAt,
      }),
    );

    for (const [name, channel] of this.channels) {
      const recipients = deliveries.filter(({ userId }) =>
        notification.via(userId).includes(name),
      );
      if (!recipients.length) {
        continue;
      }
      try {
        await channel.send(recipients);
      } catch (error: unknown) {
        this.logger.error(
          { err: error, type: notification.type, channel: name },
          'Failed to send a notification',
        );
        return;
      }
    }
  }

  findAll(
    userId: string,
    query: CursorPaginationQueryDto,
  ): Promise<CursorPaginated<DatabaseNotification>> {
    return cursorPaginate(
      ({ before, limit }) =>
        this.em.find(
          DatabaseNotification,
          { userId, ...(before ? { id: { $lt: before } } : {}) },
          { orderBy: { id: 'desc' }, limit },
        ),
      query,
    );
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    return {
      count: await this.em.count(DatabaseNotification, {
        userId,
        readAt: null,
      }),
    };
  }

  // Keeps when it was first read.
  async markAsRead(id: string, userId: string): Promise<void> {
    const notification = await this.findOwn(id, userId);
    notification.readAt ??= new Date();
    await this.em.flush();
  }

  async markAsUnread(id: string, userId: string): Promise<void> {
    const notification = await this.findOwn(id, userId);
    notification.readAt = null;
    await this.em.flush();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.em.nativeUpdate(
      DatabaseNotification,
      { userId, readAt: null },
      { readAt: new Date() },
    );
  }

  // The user's notifications as they are sent. After lastEventId, the id of the
  // last one a client received, those it missed come first.
  stream(
    userId: string,
    lastEventId?: string,
  ): Observable<BroadcastNotification> {
    return new Observable((subscriber) => {
      // Subscribed before the missed ones are read, so none is lost in between.
      // Those sent meanwhile wait, as they are newer.
      let waiting: BroadcastNotification[] | null = [];
      const live = this.broadcaster.subscribe(userId).subscribe({
        next: (notification) =>
          waiting ? waiting.push(notification) : subscriber.next(notification),
        complete: () => subscriber.complete(),
      });

      this.findMissed(userId, lastEventId).then(
        (missed) => {
          const replayed = new Set(missed.map(({ id }) => id));
          for (const notification of [
            ...missed,
            // A notification sent while the missed ones were read can be both.
            ...(waiting ?? []).filter(({ id }) => !replayed.has(id)),
          ]) {
            subscriber.next(notification);
          }
          waiting = null;
        },
        (error: unknown) => subscriber.error(error),
      );

      return () => live.unsubscribe();
    });
  }

  private async findMissed(
    userId: string,
    lastEventId?: string,
  ): Promise<BroadcastNotification[]> {
    // Ids are UUID v7, so the later ones sort after it.
    if (!lastEventId || !isUUID(lastEventId)) {
      return [];
    }
    const missed = await this.em.find(
      DatabaseNotification,
      { userId, id: { $gt: lastEventId } },
      { orderBy: { id: 'desc' }, limit: MAX_REPLAYED },
    );
    // Read ones too: another client of the user may have read them, and this
    // one still has to list them.
    return missed.reverse().map(({ id, type, data, readAt, createdAt }) => ({
      id,
      type,
      data,
      readAt,
      createdAt,
    }));
  }

  private async findOwn(
    id: string,
    userId: string,
  ): Promise<DatabaseNotification> {
    const notification = await this.em.findOne(DatabaseNotification, {
      id,
      userId,
    });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    return notification;
  }
}
