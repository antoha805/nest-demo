import { EntityManager } from '@mikro-orm/postgresql';
import { BroadcastChannel } from './channels/broadcast.channel';
import { DatabaseChannel } from './channels/database.channel';
import { MailChannel } from './channels/mail.channel';
import { Notification, NotificationChannelName } from './notification';
import { NotificationBroadcaster } from './notification-broadcaster';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  class EverywhereNotification extends Notification {
    readonly type = 'test.everywhere';
    via(): NotificationChannelName[] {
      return ['database', 'broadcast', 'mail'];
    }
    toDatabase() {
      return {};
    }
  }

  const sent: NotificationChannelName[] = [];
  const channel = <T>(name: NotificationChannelName, extra = {}) =>
    ({
      send: jest.fn(() => {
        sent.push(name);
      }),
      ...extra,
    }) as unknown as T;

  const create = (mailEnabled: boolean) =>
    new NotificationsService(
      {} as EntityManager,
      {} as NotificationBroadcaster,
      channel<DatabaseChannel>('database'),
      channel<BroadcastChannel>('broadcast'),
      channel<MailChannel>('mail', { enabled: mailEnabled }),
    );

  beforeEach(() => {
    sent.length = 0;
  });

  it('sends through the channels in order', async () => {
    await create(true).send('user', new EverywhereNotification());

    expect(sent).toEqual(['database', 'broadcast', 'mail']);
  });

  it('leaves out mail while it is off, and still sends through the others', async () => {
    await create(false).send('user', new EverywhereNotification());

    expect(sent).toEqual(['database', 'broadcast']);
  });
});
