import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Index,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { NotifiableType } from './notifiable';

// A notification as stored by the database channel, like Laravel's
// DatabaseNotification. Clients list these and mark them as read.
//
// Polymorphic, like Laravel's: notifiableType and notifiableId point to the
// record it is for, so notifiableId cannot have a foreign key. Instead, a
// trigger on each notifiable table deletes the notifications along with it.
@Entity({ tableName: 'notifications' })
// Serves the cursor pagination of a notifiable's notifications, the replay of
// those a stream missed, and the unread counts.
@Index({ properties: ['notifiableType', 'notifiableId', 'id'] })
export class DatabaseNotification {
  // Set by NotificationsService, so every channel can name the same notification.
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @Enum({
    items: () => NotifiableType,
    nativeEnumName: 'notifications_notifiabletype_enum',
    hidden: true,
  })
  notifiableType!: NotifiableType;

  @Property({ type: 'uuid', hidden: true })
  notifiableId!: string;

  // The kind of notification, such as post.commented.
  @Property({ type: 'varchar', length: 100 })
  type!: string;

  // What Notification.toDatabase returned, as of when it was sent.
  @Property({ type: 'json', columnType: 'jsonb' })
  data!: object;

  @Property({ type: 'datetime', columnType: 'timestamptz', nullable: true })
  readAt: Date | null = null;

  @Property({
    type: 'datetime',
    columnType: 'timestamptz',
    defaultRaw: 'now()',
  })
  createdAt: Opt<Date> = new Date();
}
