import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { User } from '../users/user.entity';

// A notification as stored by the database channel, like Laravel's
// DatabaseNotification. Clients list these and mark them as read.
@Entity({ tableName: 'notifications' })
// Serves the cursor pagination of a user's notifications, and the replay of
// those a stream missed.
@Index({ properties: ['userId', 'id'] })
export class DatabaseNotification {
  // Set by NotificationsService, so every channel can name the same notification.
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @ManyToOne(() => User, {
    fieldName: 'userId',
    mapToPk: true,
    deleteRule: 'cascade',
    updateRule: 'no action',
    hidden: true,
  })
  userId!: string;

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
