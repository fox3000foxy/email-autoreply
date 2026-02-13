# Email AutoReply

A small Node.js/TypeScript service that connects to an IMAP account, detects incoming emails, and generates automatic replies using a configurable AI prompt per destination account. Designed to be lightweight and easy to deploy.

## Features

- Monitor a mailbox (All Mail) across localized IMAP servers.
- Extract sender, recipients and message content (text/html).
- Per-account system prompts stored in `data/accounts.json`.
- Optional manual-forward trigger for human review.
- Pluggable transport via Nodemailer.

## Quick Start

Prerequisites:

- Node.js (16+ recommended)
- pnpm or npm

Install and build:

```bash
pnpm install
pnpm build
```

Run in development (reloads on change):

```bash
pnpm run dev
```

Run the compiled app:

```bash
pnpm run start
```

## Configuration

Copy the example environment file and set your credentials:

```bash
cp .env.example .env
```

.env variables:

- `GMAIL_USER` — IMAP/SMTP login (email)
- `GMAIL_PASS` — IMAP/SMTP password or app password
- `GROQ_API_KEY` — API key for your Groq client (used by AI reply generator)
- `MANUAL_REPLYER` — optional email address to forward messages that require manual handling

Example `.env.example` is provided in the repo.

## Accounts configuration

The project reads per-account prompts from `data/accounts.json`. Each entry should contain:

- `name`: display name used as the From name when replying
- `email`: either a string email, or a regex string prefixed with `regex:` (see example)
- `prompt`: the system prompt to feed to the AI for that account

Example `data/accounts.example.json` is provided. Copy or translate it to `data/accounts.json` and adapt the prompts.

## Example `data/accounts.json` snippet

```json
[
  {
    "name": "Support",
    "email": "support@example.com",
    "prompt": "You are the support team. Be helpful, concise and polite.\nAlways ask for the user's OS and version when relevant."
  },
  {
    "name": "Sales",
    "email": "regex:^sales@.*$",
    "prompt": "You handle sales inquiries. Answer in the customer's language, be professional, and propose a clear next step."
  }
]
```

## Folder layout

- `src/` — TypeScript source
- `data/accounts.json` — per-account prompts (not committed with secrets)
- `.env` — credentials and keys (do not commit)

## Troubleshooting

- If IMAP access fails, verify `GMAIL_USER`/`GMAIL_PASS` and that IMAP is enabled for the account.
- If mailbox selection fails for localized servers, the app tries to discover the server's All Mail folder automatically.

## Contributing

Contributions welcome — open issues or PRs. Keep changes small and add tests where applicable.

## License

MIT
