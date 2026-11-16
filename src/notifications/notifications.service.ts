import { randomUUIDv7 } from 'node:crypto';
import { raw } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Observable } from 'rxjs';
import { cursorPaginate, CursorPaginated } from '../common/cursor-paginated';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto';
import { NotifiableUser } from '../users/notifiable-user';
import { User } from '../users/user.entity';
import { BroadcastChannel } from './channels/broadcast.channel';
import { DatabaseChannel } from './channels/database.channel';
import { MailChannel } from './channels/mail.channel';
import {
  NotificationChannel,
  NotificationDelivery,
} from './channels/notification-channel';
import { SmsChannel } from './channels/sms.channel';
import { DatabaseNotification } from './database-notification.entity';
import { NotifiableType } from './notifiable';
import { Notification, NotificationChannelName } from './notification';
import {
  BroadcastNotification,
  NotificationBroadcaster,
} from './notification-broadcaster';

// Users by id, or ready-made, such as from a user already loaded.
export type NotificationRecipients =
  string | NotifiableUser | (string | NotifiableUser)[];

// The notifications of a user, as the notifiable they are for.
const ofUser = (userId: string) => ({
  notifiableType: NotifiableType.USER,
  notifiableId: userId,
});

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
  // database comes first, and mail and SMS go to outside services, so they do
  // not hold up the rest.
  private readonly channels: [NotificationChannelName, NotificationChannel][];

  constructor(
    private readonly em: EntityManager,
    private readonly broadcaster: NotificationBroadcaster,
    databaseChannel: DatabaseChannel,
    broadcastChannel: BroadcastChannel,
    mailChannel: MailChannel,
    smsChannel: SmsChannel,
  ) {
    this.channels = [
      ['database', databaseChannel],
      ['broadcast', broadcastChannel],
      ['mail', mailChannel],
      ['sms', smsChannel],
    ];
  }

  // Sent after the change it is about has been saved, so a failure is logged
  // rather than failing the request. It also stops the later channels, which
  // could otherwise name a notification that was not stored. Users that do
  // not exist, such as deleted since, are skipped.
  async send(
    to: NotificationRecipients,
    notification: Notification,
  ): Promise<void> {
    let notifiables: NotifiableUser[];
    try {
      notifiables = await this.findNotifiables(to);
    } catch (error: unknown) {
      this.logger.error(
        { err: error, type: notification.type },
        'Failed to find whom to notify',
      );
      return;
    }

    const createdAt = new Date();
    const deliveries = notifiables.map((notifiable) => ({
      id: randomUUIDv7(),
      notifiable,
      notification,
      createdAt,
    }));

    for (const [name, channel] of this.channels) {
      const recipients: NotificationDelivery[] = deliveries.filter(
        ({ notifiable }) => notification.via(notifiable).includes(name),
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

  // Once each, in the order given. Those given by id are loaded in one query.
  private async findNotifiables(
    to: NotificationRecipients,
  ): Promise<NotifiableUser[]> {
    const items = [to].flat();
    const ids = items.filter((item) => typeof item === 'string');
    // Forked, so the partly loaded users stay out of the request's identity map.
    const users = ids.length
      ? await this.em
          .fork()
          .find(
            User,
            { id: { $in: ids } },
            { fields: [...NotifiableUser.FIELDS] },
          )
      : [];
    const found = new Map(
      users.map((user) => [user.id, NotifiableUser.from(user)]),
    );

    const notifiables = new Map<string, NotifiableUser>();
    for (const item of items) {
      const notifiable = typeof item === 'string' ? found.get(item) : item;
      if (notifiable && !notifiables.has(notifiable.id)) {
        notifiables.set(notifiable.id, notifiable);
      }
    }
    return [...notifiables.values()];
  }

  findAll(
    userId: string,
    query: CursorPaginationQueryDto,
  ): Promise<CursorPaginated<DatabaseNotification>> {
    return cursorPaginate(
      ({ before, limit }) =>
        this.em.find(
          DatabaseNotification,
          { ...ofUser(userId), ...(before ? { id: { $lt: before } } : {}) },
          { orderBy: { id: 'desc' }, limit },
        ),
      query,
    );
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
      { ...ofUser(userId), readAt: null },
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
      .where(ofUser(userId))
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
      { ...ofUser(userId), id: { $gt: lastEventId } },
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
      ...ofUser(userId),
    });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    return notification;
  }
}
