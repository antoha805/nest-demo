type MailPart =
  | { kind: 'line'; text: string }
  | { kind: 'action'; text: string; url: string };

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

// What Notification.toMail returns, like Laravel's MailMessage: built from
// lines and buttons, and rendered as both plain text and HTML.
//
//   new MailMessage()
//     .subject('New comment')
//     .line('Someone commented on your post.')
//     .action('View the post', `/posts/${postId}`);
export class MailMessage {
  private subjectText?: string;
  private greetingText = 'Hello!';
  private salutationText?: string;
  private readonly parts: MailPart[] = [];

  subject(subject: string): this {
    this.subjectText = subject;
    return this;
  }

  greeting(greeting: string): this {
    this.greetingText = greeting;
    return this;
  }

  line(text: string): this {
    this.parts.push({ kind: 'line', text });
    return this;
  }

  // A button. A relative url is resolved against APP_URL.
  action(text: string, url: string): this {
    this.parts.push({ kind: 'action', text, url });
    return this;
  }

  // Closes the mail, such as "Regards, the team".
  salutation(salutation: string): this {
    this.salutationText = salutation;
    return this;
  }

  render(appUrl: string): RenderedMail {
    if (!this.subjectText) {
      throw new Error('A mail needs a subject');
    }
    const parts = this.parts.map((part) =>
      part.kind === 'action'
        ? { ...part, url: resolveUrl(part.url, appUrl) }
        : part,
    );
    const salutation = this.salutationText ? [this.salutationText] : [];

    const text = [
      this.greetingText,
      ...parts.map((part) =>
        part.kind === 'action' ? `${part.text}: ${part.url}` : part.text,
      ),
      ...salutation,
    ].join('\n\n');

    const paragraph = (content: string) =>
      `<p style="margin:0 0 16px">${content}</p>`;
    const html = [
      `<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(this.greetingText)}</h1>`,
      ...parts.map((part) =>
        part.kind === 'action'
          ? paragraph(
              `<a href="${escapeHtml(part.url)}" style="display:inline-block;padding:10px 18px;background:#2d3748;color:#ffffff;border-radius:4px;text-decoration:none">${escapeHtml(part.text)}</a>`,
            )
          : paragraph(escapeHtml(part.text)),
      ),
      ...salutation.map((line) => paragraph(escapeHtml(line))),
    ].join('\n');

    return {
      subject: this.subjectText,
      text,
      html: `<!doctype html>\n<html><body style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1a202c">\n${html}\n</body></html>`,
    };
  }
}

// Only web links, so a button cannot run a script, such as with javascript:.
function resolveUrl(url: string, appUrl: string): string {
  const resolved = new URL(url, appUrl);
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    throw new Error(`A mail button cannot link to ${resolved.protocol}`);
  }
  return resolved.href;
}

// Lines hold user content, such as nicknames and post titles.
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
