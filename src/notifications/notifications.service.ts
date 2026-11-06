import { randomUUIDv7 } from 'node:crypto';
import { raw } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Observable } from 'rxjs';
import { cursorPaginate, CursorPaginated } from '../common/cursor-paginated';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto';
import { BroadcastChannel } from './channels/broadcast.channel';
import { DatabaseChannel } from './channels/database.channel';
import { MailChannel } from './channels/mail.channel';
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

export type StreamEvent =
  | { type: 'notification'; notification: BroadcastNotification }
  // The user's unread notifications, up to and including the newest they have.
  | { type: 'unread-count'; count: number; newestId: string | null };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // In the order they run: a broadcast names the stored notification, so the
  // database comes first, and mail is slowest, so it does not hold up the rest.
  // Mail is left out while it is off, so notifications that list it are still
  // sent through the others.
  private readonly channels: [NotificationChannelName, NotificationChannel][];

  constructor(
    private readonly em: EntityManager,
    private readonly broadcaster: NotificationBroadcaster,
    databaseChannel: DatabaseChannel,
    broadcastChannel: BroadcastChannel,
    mailChannel: MailChannel,
  ) {
    this.channels = [
      ['database', databaseChannel],
      ['broadcast', broadcastChannel],
    ];
    if (mailChannel.enabled) {
      this.channels.push(['mail', mailChannel]);
    }
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

  countUnread(userId: string): Promise<number> {
    return this.em.count(DatabaseNotification, { userId, readAt: null });
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
  // last one a client received, those it missed come first. Then the unread
  // count, which every notification after it adds one to, so a client's badge
  // is right again after each (re)connection.
  stream(userId: string, lastEventId?: string): Observable<StreamEvent> {
    return new Observable((subscriber) => {
      const send = (notification: BroadcastNotification) =>
        subscriber.next({ type: 'notification', notification });

      // Subscribed before the missed ones are read, so none is lost in between.
      // Those sent meanwhile wait.
      let waiting: BroadcastNotification[] | null = [];
      const live = this.broadcaster.subscribe(userId).subscribe({
        next: (notification) =>
          waiting ? waiting.push(notification) : send(notification),
        complete: () => subscriber.complete(),
      });

      (async () => {
        const missed = await this.findMissed(userId, lastEventId);
        return { missed, ...(await this.unreadSnapshot(userId)) };
      })().then(
        ({ missed, count, newestId }) => {
          missed.forEach(send);
          subscriber.next({ type: 'unread-count', count, newestId });
          const replayed = new Set(missed.map(({ id }) => id));
          for (const notification of waiting ?? []) {
            // Those up to the newest are in the count already. Ids are UUID v7
            // in lowercase, so they compare by time as strings.
            if (
              !replayed.has(notification.id) &&
              (!newestId || notification.id > newestId)
            ) {
              send(notification);
            }
          }
          waiting = null;
        },
        (error: unknown) => subscriber.error(error),
      );

      return () => live.unsubscribe();
    });
  }

  // In one statement, so the count and the newest id describe the same moment.
  private async unreadSnapshot(
    userId: string,
  ): Promise<{ count: number; newestId: string | null }> {
    return this.em
      .createQueryBuilder(DatabaseNotification)
      .select([
        raw('COUNT(*) FILTER (WHERE "readAt" IS NULL)::int AS "count"'),
        raw('MAX("id"::text) AS "newestId"'),
      ])
      .where({ userId })
      .execute('get', false);
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
