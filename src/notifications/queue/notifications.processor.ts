import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { User } from '../../users/user.entity';
import { NotificationsService } from '../notifications.service';
import {
  FAN_OUT_JOB,
  FanOutJobData,
  NOTIFICATIONS_QUEUE,
  SEND_JOB,
  SendJobData,
} from './notification-queue';
import { QueuedNotifications } from './queued-notifications';

// Users per send job: one query loads them, and one statement stores their
// notifications.
export const CHUNK_SIZE = 500;

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly em: EntityManager,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly queuedNotifications: QueuedNotifications,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  // In its own context, like a request, as there is none.
  process(job: Job): Promise<void> {
    return RequestContext.create(this.em, () => {
      switch (job.name) {
        case FAN_OUT_JOB:
          return this.fanOut(job as Job<FanOutJobData>);
        case SEND_JOB:
          return this.send(job as Job<SendJobData>);
        default:
          throw new Error(`Unknown job ${job.name}`);
      }
    });
  }

  // Splits the users into send jobs, paging by id: unlike an offset, the
  // cursor needs no row of its own, so users deleted meanwhile do not shift
  // the pages. A send job's id names its first user, so one queued again by a
  // retry is ignored.
  private async fanOut(job: Job<FanOutJobData>): Promise<void> {
    const { except, until, type, data } = job.data;
    let { cursor } = job.data;
    for (;;) {
      const users = await this.em.fork().find(
        User,
        {
          id: {
            $lte: until,
            ...(cursor ? { $gt: cursor } : {}),
            ...(except.length ? { $nin: except } : {}),
          },
        },
        { fields: ['id'], orderBy: { id: 'asc' }, limit: CHUNK_SIZE },
      );
      if (!users.length) {
        return;
      }
      const sendData: SendJobData = {
        type,
        data,
        userIds: users.map(({ id }) => id),
      };
      await this.queue.add(SEND_JOB, sendData, {
        jobId: `${job.id}-${users[0].id}`,
      });
      cursor = users[users.length - 1].id;
      await job.updateData({ ...job.data, cursor });
      if (users.length < CHUNK_SIZE) {
        return;
      }
    }
  }

  // Users deleted meanwhile are skipped by NotificationsService.send.
  private async send(job: Job<SendJobData>): Promise<void> {
    const notification = await this.queuedNotifications.make(job.data);
    if (notification) {
      await this.notificationsService.send(job.data.userIds, notification);
    }
  }
}
