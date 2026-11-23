import type { Response } from 'express';

export interface ConsentView {
  // As the client registered it, so anyone can choose it: the page shows
  // where the user will be sent too, which the client cannot fake.
  clientName?: string;
  redirectUri: string;
  // The signed authorization request, which the form sends back.
  requestToken: string;
  writeRequested: boolean;
  email?: string;
  error?: string;
}

// The page /authorize shows: the user signs in and agrees, or declines.
// Plain HTML with no scripts, as it is the only page the API serves.
export function sendConsentPage(
  res: Response,
  view: ConsentView,
  status = 200,
): void {
  const clientName = view.clientName?.trim() || 'An app';
  const body = `
    <h1>Connect ${escape(clientName)} to nest-demo</h1>
    <p class="muted">It will act as you through the MCP server, and send you back to <strong>${escape(destination(view.redirectUri))}</strong>.</p>
    ${view.error ? `<p class="error" role="alert">${escape(view.error)}</p>` : ''}
    <form method="post" action="/api/oauth/consent">
      <input type="hidden" name="request" value="${escape(view.requestToken)}">
      <label>Email <input type="email" name="email" autocomplete="username" value="${escape(view.email ?? '')}" required autofocus></label>
      <label>Password <input type="password" name="password" autocomplete="current-password" required></label>
      <fieldset>
        <legend>It will be able to</legend>
        <label class="check"><input type="checkbox" checked disabled> Read posts, comments and your notifications</label>
        ${
          view.writeRequested
            ? '<label class="check"><input type="checkbox" name="write" value="on" checked> Write as you: posts, comments, likes and your profile, as far as your permissions allow</label>'
            : ''
        }
      </fieldset>
      <div class="actions">
        <button type="submit" name="decision" value="allow">Allow</button>
        <button type="submit" name="decision" value="deny" formnovalidate class="secondary">Deny</button>
      </div>
    </form>`;
  sendPage(res, status, `Connect ${clientName}`, body);
}

export function sendErrorPage(
  res: Response,
  status: number,
  message: string,
): void {
  sendPage(
    res,
    status,
    'Cannot connect',
    `<h1>Cannot connect</h1><p>${escape(message)}</p>`,
  );
}

function sendPage(
  res: Response,
  status: number,
  title: string,
  body: string,
): void {
  res
    .status(status)
    .set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // No scripts, and no framing, so another site cannot overlay the page
      // to trick a click on Allow.
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    })
    .send(
      `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>${STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>`,
    );
}

// The host for web clients, or the whole URI for apps with their own scheme,
// such as cursor://.
function destination(redirectUri: string): string {
  const url = new URL(redirectUri);
  return url.protocol === 'http:' || url.protocol === 'https:'
    ? url.host
    : redirectUri;
}

function escape(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
}

const STYLE = `
:root { color-scheme: light dark; --bg: #f6f6f4; --card: #fff; --text: #1c1c1a; --muted: #5f5f5a; --line: #d8d8d2; --accent: #1f5fbf; --error: #b3261e; }
@media (prefers-color-scheme: dark) { :root { --bg: #161615; --card: #20201e; --text: #ececea; --muted: #a3a39d; --line: #3a3a37; --accent: #7aa7ff; --error: #ff8a80; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 26rem; margin: 3rem auto; padding: 1.5rem; background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
@media (max-width: 30rem) { main { margin: 0; min-height: 100vh; border: 0; border-radius: 0; padding: 1.5rem 1rem; } }
h1 { font-size: 1.25rem; margin: 0 0 .5rem; overflow-wrap: anywhere; }
p { margin: 0 0 1rem; overflow-wrap: anywhere; }
.muted { color: var(--muted); font-size: .9rem; }
.error { color: var(--error); }
label { display: block; margin: 0 0 .75rem; font-size: .9rem; }
input[type=email], input[type=password] { display: block; width: 100%; margin-top: .25rem; padding: .55rem .65rem; font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 8px; }
fieldset { margin: 1rem 0; padding: .75rem; border: 1px solid var(--line); border-radius: 8px; }
legend { padding: 0 .25rem; font-size: .9rem; color: var(--muted); }
.check { display: flex; gap: .5rem; align-items: flex-start; margin: .25rem 0; }
.check input { margin-top: .3rem; }
.actions { display: flex; gap: .5rem; }
button { flex: 1; padding: .6rem; font: inherit; font-weight: 600; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: var(--card); cursor: pointer; }
button.secondary { background: transparent; color: var(--text); border-color: var(--line); }
`;
