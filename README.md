
# Email AutoReply

<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=180&section=header&text=Email%20AutoReply&fontSize=42&fontColor=fff&animation=twinkling&fontAlignY=32&desc=AI-powered%20email%20autoresponder%20template&descSize=18&descAlignY=52" />

[![Stars](https://img.shields.io/github/stars/fox3000foxy/email-autoreply?style=for-the-badge&color=f5c842)](https://github.com/fox3000foxy/email-autoreply/stargazers)
[![Forks](https://img.shields.io/github/forks/fox3000foxy/email-autoreply?style=for-the-badge&color=8B5CF6)](https://github.com/fox3000foxy/email-autoreply/network/members)
[![Issues](https://img.shields.io/github/issues/fox3000foxy/email-autoreply?style=for-the-badge&color=5865F2)](https://github.com/fox3000foxy/email-autoreply/issues)
[![Last Commit](https://img.shields.io/github/last-commit/fox3000foxy/email-autoreply?style=for-the-badge&color=181717)](https://github.com/fox3000foxy/email-autoreply/commits/main)

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=24&pause=1000&color=8B5CF6&center=true&vCenter=true&width=500&lines=AI+Email+AutoReply+Template;Ready+for+CI%2FCD+and+Self-Hosting;Secure+and+Configurable" alt="Typing SVG" />

</div>

---

# Table of Contents

- [✨ About This Template](#-about-this-template)
- [Beginner Tutorial](#beginner-tutorial)
- [How it works](#how-it-works)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Step 1 — Configure your environment](#step-1--configure-your-environment)
- [Step 2 — Accounts configuration](#step-2--accounts-configuration)
- [Step 3 — Run locally or in CI](#step-3--run-locally-or-in-ci)
- [GitHub Actions & Secrets](#github-actions--secrets)
- [Folder layout](#folder-layout)
- [Troubleshooting](#troubleshooting)
- [Reference](#reference)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ About This Template

**Email AutoReply** is a modern, AI-powered email autoresponder for IMAP mailboxes. It is designed as a template you can:

- **Fork** on GitHub and use as-is
- **Clone** and adapt for your own needs
- **Copy files** or integrate logic into an existing Node.js project

> [!TIP]
> You do **not** have to fork this repo to use it! You can clone, download, or copy-paste the code into your own project structure.

This template is suitable for:
- Personal automation (Gmail, Outlook, etc.)
- Teams and shared mailboxes
- CI/CD workflows (GitHub Actions)
- Self-hosted or cloud deployments


---

## Beginner Tutorial

This section is for users new to Node.js, email automation, or GitHub Actions. Follow these steps for a smooth first experience.

### 1. Install Node.js and pnpm

- Download and install [Node.js LTS](https://nodejs.org/en/download/) (choose the LTS version).
- Install pnpm (recommended for this project):

```bash
npm install -g pnpm
```

### 2. Clone the repository

```bash
git clone https://github.com/your-username/email-autoreply.git
cd email-autoreply
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Configure your environment

- Copy the example environment file:

  ```bash
  cp .env.example .env
  ```
- Open `.env` in a text editor and fill in your email credentials and API keys.

#### Gmail Setup Tips

> [!TIP]
> For Gmail, you need to:
> - Enable IMAP in your Gmail settings ([see how](https://support.google.com/mail/answer/7126229?hl=en))
> - Create an [App Password](https://support.google.com/accounts/answer/185833?hl=en) if you have 2FA enabled
> - Use your Gmail address for `MAILUSER` and the App Password for `MAILPASS`

### 5. Create your accounts.json

- Copy `data/accounts.example.json` to `data/accounts.json`:

  ```bash
  cp data/accounts.example.json data/accounts.json
  ```
- Edit `data/accounts.json` to set your own names, emails, and prompts.

### 6. Run the app

```bash
pnpm run start
```

If everything is set up correctly, the app will connect to your mailbox and start processing emails.


### 7. Common beginner issues
---

## ⚠️ Important: Conversation Memory in GitHub Actions

> [!WARNING]
> When running in GitHub Actions (CI) mode, **conversation memory is not persistent between runs**. This means the app cannot remember previous exchanges with the same sender across different runs, as the memory is not stored in a shared or durable location. For best results and true conversation context, run the app in a persistent environment (e.g., a server or VM) where the `data/` folder is preserved.

| Problem | Solution |
|---|---|
| `Error: Login failed` | Double-check your email and password. For Gmail, use an App Password. |
| `IMAP not enabled` | Enable IMAP in your email provider's settings. |
| `Cannot find module` | Run `pnpm install` again to ensure all dependencies are installed. |
| `accounts.json` not found | Make sure you copied and edited `data/accounts.json`. |

> [!NOTE]
> If you get stuck, check the Troubleshooting section below or open an issue on GitHub.


---

## How it works

```
Incoming email
    │
    ▼
[IMAP fetcher] ──► [AI Reply Generator] ──► [SMTP Sender]
    │
    └─► [Conversation Memory]
```

In **action mode** (for CI/CD):

```
┌─────────────┐
│  lastId     │
└─────┬───────┘
      │
      ▼
[Batch fetch new mails]
      │
      ▼
[Process & reply]
      │
      ▼
[Update lastId]
```

---

## Features

- Monitors a mailbox (All Mail) across localized IMAP servers
- Extracts sender, recipients, and message content (text/html)
- Per-account AI prompts stored in `data/accounts.json`
- Conversation memory for context-aware replies
- Optional manual-forward trigger for human review
- Pluggable SMTP transport (Nodemailer)
- **CI/CD ready:** GitHub Actions workflow for batch processing
- **Secure:** All secrets via GitHub Secrets or `.env` (never committed)

---


## Prerequisites

- Node.js (20+ recommended)
- pnpm or npm
- IMAP/SMTP credentials (e.g., Gmail, Outlook, etc.)
- Groq API key (for AI replies)
- (For CI) GitHub account and repository

> [!NOTE]
> For Gmail, you may need an App Password and to enable IMAP in your account settings.
> #### How to create a Google App Password
>
> If you use Gmail and have 2-Step Verification enabled, you must create an App Password for this app:
> 
> 1. Go to your [Google Account Security page](https://myaccount.google.com/security).
> 2. Under "Signing in to Google", select **App Passwords**.
> 3. Sign in again if prompted.
> 4. Under "Select app", choose **Other (Custom name)** and enter a name (e.g., `EmailAutoReply`).
> 5. Click **Generate**.
> 6. Copy the 16-character password and use it as `MAILPASS` in your `.env` file.

> [!WARNING]
> Never share your App Password. Treat it like your real password.

### How to get a Groq API Key

1. Go to the [Groq Developer Portal](https://console.groq.com/keys).
2. Sign in or create a free account.
3. Click **Create API Key** and give it a name (e.g., `email-autoreply`).
4. Copy the generated key and paste it as `GROQ_API_KEY` in your `.env` file.

> [!WARNING]
> Keep your Groq API key secret. Never share it or commit it to a public repository.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run in development (reloads on change)
pnpm run dev

# Run the compiled app
pnpm run start

# Run in batch mode (for CI or one-shot processing)
pnpm run start -- --action
```

---

## Step 1 — Configure your environment

Copy the example environment file and set your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your IMAP/SMTP and AI provider credentials:

```env
# Main configuration (.env)
# By default, all values are set for Gmail.

# --- Gmail (default IMAP/SMTP) ---
MAILUSER=your.email@gmail.com
MAILPASS=your_app_password

# --- Groq API (for AI) ---
GROQ_API_KEY=sk-your-groq-key

# --- SMTP (Nodemailer) ---
NODEMAILER_HOST=smtp.gmail.com
NODEMAILER_PORT=587
NODEMAILER_SECURE=false

# --- IMAP ---
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true

# --- Optional ---
MANUAL_REPLYER=human@yourdomain.com
```

> [!WARNING]
> **Never commit your `.env` file or secrets to the repository.** Use GitHub Secrets for CI/CD.

---

## Step 2 — Accounts configuration

Define per-account prompts in `data/accounts.json`. Each entry should contain:

- `name`: display name for replies
- `email`: string or regex (prefix with `regex:`)
- `prompt`: system prompt for the AI

Example:

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

> [!TIP]
> Use `data/accounts.example.json` as a template. Never commit secrets.

---

## Step 3 — Run locally or in CI

- **Development:** `pnpm run dev` (auto-reloads)
- **Production:** `pnpm run start`
- **Batch/CI mode:** `pnpm run start -- --action`

In `--action` mode, the app does not open an IMAP listener. It fetches only new mails (UID > `data/lastId`), processes them, and updates `data/lastId`. On first run, it initializes `lastId` to the latest UID (no old mails processed).

---

## GitHub Actions & Secrets

> ⚡ **Precompiled runtime**
>
> The build workflow automatically produces a `runtime` branch containing the `dist` folder and `node_modules`. The cron workflow checks out that branch instead of rebuilding from scratch, cutting run time from about 20 s to 10 s.
>

This template includes a ready-to-use GitHub Actions workflow (`.github/workflows/cron.yml`) for automated batch processing.

### Workflow overview

The repository includes two actions: a standard build job and a cron processor. The build job not only lints and compiles the source, but also **prepares a runtime branch** containing the compiled output and `node_modules` so that the cron workflow can run in about **10 seconds instead of ~20**.

1. **Checkout repository**
2. **Setup Node.js & pnpm**
3. **Restore `lastId` from `data` branch**
4. **Prepare accounts config from secret**
5. **Install & build** (the build job also publishes a `runtime` branch)
6. **Process new emails in action mode**
7. **Publish updated `lastId` to `data` branch`

> When you **use this template** or **fork** the repo, the `build.yml` workflow will automatically run on the first push to `master` (you can also trigger it manually via _Actions → Build → Run workflow_). That initial run generates the runtime snapshot with compiled code + dependencies; the cron job then consumes that branch, shaving roughly half the execution time.


> [!NOTE]
> The workflow is idempotent: it never processes the same email twice. On first run, no old emails are processed.

### Using GitHub Secrets

- Go to `Settings > Secrets and variables > Actions` in your GitHub repo.
- Add secrets: `MAILUSER`, `MAILPASS`, `GROQ_API_KEY`, `IMAP_HOST`, `IMAP_PORT`, `IMAP_TLS`, `NODEMAILER_HOST`, `NODEMAILER_PORT`, `NODEMAILER_SECURE`, `MANUAL_REPLYER`, etc.
- For account config, add `ACCOUNTS_JSON` with the minified content of your `data/accounts.json`.

```json
[{"name":"Support","email":"support@example.com","prompt":"You are the support team. Be helpful, concise and polite."}]
```

> [!WARNING]
> **Never commit secrets or `.env` files.**

---

## Folder layout

- `src/` — TypeScript source
- `data/accounts.json` — per-account prompts (never committed)
- `.env` — credentials and keys (never committed)

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| IMAP access fails | Wrong credentials or IMAP not enabled | Check `MAILUSER`/`MAILPASS` and IMAP settings |
| No new mails processed | `lastId` not initialized or no new mails | Check `data/lastId` and mailbox |
| App crashes in CI | Missing or invalid secrets | Check GitHub Secrets and workflow logs |
| Mailbox selection fails | Localized server or folder name | App auto-discovers All Mail folder |

> [!NOTE]
> For more help, open an issue or PR.

---

## Reference

<details>
<summary><strong>How batch mode works</strong></summary>

1. Reads `data/lastId` (from file or branch)
2. Fetches only mails with UID > `lastId`
3. Processes and replies to each
4. Updates `data/lastId` with the latest UID

This ensures no mail is processed twice, and the state is preserved across runs (even in CI/CD).

</details>

<details>
<summary><strong>How to extend</strong></summary>

- Add new AI providers by extending `src/services/AIService/ReplyService.ts`
- Add new mail providers by extending `src/services/MailService/ImapService.ts`
- Customize prompts per account in `data/accounts.json`

</details>

---

## Contributing

Contributions welcome! Open issues or PRs. Keep changes small and add tests where possible.

---

## License

MIT
