import { MailMessage } from './mail-message';

describe('MailMessage', () => {
  const appUrl = 'https://example.com/app/';

  it('renders the parts in order as text and HTML', () => {
    const mail = new MailMessage()
      .subject('New comment')
      .greeting('Hi ann!')
      .line('Someone commented on your post.')
      .action('View the post', 'posts/1')
      .line('Thanks for writing.')
      .salutation('Regards, nest-demo')
      .render(appUrl);

    expect(mail.subject).toBe('New comment');
    expect(mail.text).toBe(
      [
        'Hi ann!',
        'Someone commented on your post.',
        'View the post: https://example.com/app/posts/1',
        'Thanks for writing.',
        'Regards, nest-demo',
      ].join('\n\n'),
    );
    const order = [
      'Hi ann!',
      'Someone commented',
      'href="https://example.com/app/posts/1"',
      'Thanks for writing.',
      'Regards, nest-demo',
    ].map((part) => mail.html.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('greets with Hello! by default', () => {
    const mail = new MailMessage().subject('S').render(appUrl);

    expect(mail.text).toBe('Hello!');
  });

  it('escapes the HTML, but not the text', () => {
    const mail = new MailMessage()
      .subject('S')
      .greeting('<b>')
      .line(`"Tom & Jerry's" <script>`)
      .action('<i>', 'https://example.com/?a=1&b="2"')
      .render(appUrl);

    expect(mail.html).toContain(
      '<h1 style="margin:0 0 16px;font-size:20px">&lt;b&gt;</h1>',
    );
    expect(mail.html).toContain(
      '&quot;Tom &amp; Jerry&#39;s&quot; &lt;script&gt;',
    );
    expect(mail.html).toContain(
      'href="https://example.com/?a=1&amp;b=%222%22"',
    );
    expect(mail.html).not.toContain('<script>');
    expect(mail.text).toContain(`"Tom & Jerry's" <script>`);
  });

  it('keeps absolute links', () => {
    const mail = new MailMessage()
      .subject('S')
      .action('Go', 'https://other.example/x')
      .render(appUrl);

    expect(mail.text).toContain('Go: https://other.example/x');
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'mailto:a@example.com'])(
    'rejects a button linking to %s',
    (url) => {
      const message = new MailMessage().subject('S').action('Go', url);

      expect(() => message.render(appUrl)).toThrow(/cannot link/);
    },
  );

  it('requires a subject', () => {
    expect(() => new MailMessage().line('x').render(appUrl)).toThrow(/subject/);
  });
});
