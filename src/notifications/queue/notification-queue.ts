import { EntityManager } from '@mikro-orm/postgresql';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { User } from '../../users/user.entity';
import { QueuedNotification } from './queued-notifications';

export const NOTIFICATIONS_QUEUE = 'notifications';

export const FAN_OUT_JOB = 'fan-out';
export const SEND_JOB = 'send';

// Sends a notification to every user but those excepted, in chunks.
export interface FanOutJobData extends QueuedNotification {
  except: string[];
  // The newest user when it was queued, so users who join later are left out.
  until: string;
  // The last user of the chunks queued so far, kept with the job, so a retry
  // carries on from there.
  cursor?: string;
}

// Sends a notification to one chunk of users.
export interface SendJobData extends QueuedNotification {
  userIds: string[];
}

// Notifications sent by the queue's worker rather than in the request, for
// those that go to many users.
@Injectable()
export class NotificationQueue {
  constructor(
    private readonly em: EntityManager,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  // To every user who exists now, but those excepted. A job id makes it once:
  // another with the same id is ignored while the first is kept.
  async sendToAllUsers(
    notification: QueuedNotification,
    { except = [], jobId }: { except?: string[]; jobId?: string } = {},
  ): Promise<void> {
    const [newest] = await this.em
      .fork()
      .find(User, {}, { fields: ['id'], orderBy: { id: 'desc' }, limit: 1 });
    if (!newest) {
      return;
    }
    const data: FanOutJobData = { ...notification, except, until: newest.id };
    await this.queue.add(FAN_OUT_JOB, data, { jobId });
  }
}
