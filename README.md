# Email AutoReply

A small Node.js/TypeScript service that connects to an IMAP account, detects incoming emails, and generates automatic replies using a configurable AI prompt per destination account. Designed to be lightweight and easy to deploy.

## Features

- Monitor a mailbox (All Mail) across localized IMAP servers.
- Extract sender, recipients and message content (text/html).
- Per-account system prompts stored in `data/accounts.json`.
- Conversation memory: the app keeps track of previous exchanges with each sender to generate more context-aware replies.
- Optional manual-forward trigger for human review.
- Pluggable transport via Nodemailer.

## Quick Start

Prerequisites:

- Node.js (20+ recommended)
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

Example `.env.example` is provided in the repo. By default, all values are set for Gmail.

**.env variables:**

```env
# Main configuration (.env)
# By default, all values are set for Gmail.

# --- Gmail (default IMAP/SMTP) ---
# Gmail credentials (user and app password)
USER=your.email@gmail.com
PASS=your_app_password

# --- Groq API (for AI) ---
GROQ_API_KEY=sk-your-groq-key

# --- SMTP (Nodemailer) ---
# Defaults to Gmail
NODEMAILER_HOST=smtp.gmail.com   # Gmail default SMTP host
NODEMAILER_PORT=587              # Gmail default SMTP port
NODEMAILER_SECURE=false          # STARTTLS (Gmail)

# --- IMAP ---
# Defaults to Gmail
IMAP_HOST=imap.gmail.com         # Gmail default IMAP host
IMAP_PORT=993                    # Gmail default IMAP port
IMAP_TLS=true                    # Secure connection (TLS)

# --- Optional ---
# Email address for manual review (if needed)
MANUAL_REPLYER=human@yourdomain.com
```

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
