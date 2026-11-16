import { EntityManager } from '@mikro-orm/postgresql';
import { NotifiableUser } from '../users/notifiable-user';
import { BroadcastChannel } from './channels/broadcast.channel';
import { DatabaseChannel } from './channels/database.channel';
import { MailChannel } from './channels/mail.channel';
import { NotificationDelivery } from './channels/notification-channel';
import { SmsChannel } from './channels/sms.channel';
import { Notification, NotificationChannelName } from './notification';
import { NotificationBroadcaster } from './notification-broadcaster';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  class EverywhereNotification extends Notification {
    readonly type = 'test.everywhere';
    via(): NotificationChannelName[] {
      return ['database', 'broadcast', 'mail', 'sms'];
    }
    toDatabase() {
      return {};
    }
  }

  const ann = new NotifiableUser('ann-id', 'ann', 'ann@example.com', null);
  const bob = new NotifiableUser('bob-id', 'bob', 'bob@example.com', null);

  // What each channel got, by name.
  const sent: [NotificationChannelName, string[]][] = [];
  const channel = <T>(name: NotificationChannelName) =>
    ({
      send: jest.fn((deliveries: NotificationDelivery[]) => {
        sent.push([name, deliveries.map(({ notifiable }) => notifiable.id)]);
      }),
    }) as unknown as T;

  // Finds the users given, as the database would.
  const find = jest.fn();
  const create = () =>
    new NotificationsService(
      { fork: () => ({ find }) } as unknown as EntityManager,
      {} as NotificationBroadcaster,
      channel<DatabaseChannel>('database'),
      channel<BroadcastChannel>('broadcast'),
      channel<MailChannel>('mail'),
      channel<SmsChannel>('sms'),
    );

  beforeEach(() => {
    sent.length = 0;
    find.mockReset();
  });

  it('sends through the channels in order', async () => {
    await create().send(ann, new EverywhereNotification());

    expect(sent.map(([name]) => name)).toEqual([
      'database',
      'broadcast',
      'mail',
      'sms',
    ]);
    expect(find).not.toHaveBeenCalled();
  });

  it('loads users given by id, once each, in order, skipping missing ones', async () => {
    find.mockResolvedValue([
      { id: 'bob-id', nickname: 'bob', email: 'bob@example.com', phone: null },
    ]);

    await create().send(
      ['bob-id', ann, 'gone-id', 'bob-id', ann],
      new EverywhereNotification(),
    );

    expect(find).toHaveBeenCalledTimes(1);
    expect(sent[0]).toEqual(['database', ['bob-id', 'ann-id']]);
  });

  it('picks the channels for each notifiable', async () => {
    class OnlyMailForAnn extends Notification {
      readonly type = 'test.only-mail-for-ann';
      via(notifiable: NotifiableUser): NotificationChannelName[] {
        return notifiable.nickname === 'ann' ? ['mail'] : ['database'];
      }
      toDatabase() {
        return {};
      }
    }

    await create().send([ann, bob], new OnlyMailForAnn());

    expect(sent).toEqual([
      ['database', ['bob-id']],
      ['mail', ['ann-id']],
    ]);
  });

  it('sends nothing when the users cannot be loaded', async () => {
    find.mockRejectedValue(new Error('database is down'));

    await expect(
      create().send('ann-id', new EverywhereNotification()),
    ).resolves.toBeUndefined();
    expect(sent).toEqual([]);
  });
});
