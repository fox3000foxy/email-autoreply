import { franc } from 'franc';
import type Groq from 'groq-sdk';
import type { ImapFlow } from 'imapflow';
import { decorate, inject, injectable } from 'inversify';
import { simpleParser } from 'mailparser';
import type { Transporter } from 'nodemailer';
import { TYPES } from '../di/types';
import { AccountsService } from './AccountsService';

const MANUAL_REPLY_TRIGGER = '<manual_reply_required>';

type ParsedMailLike = {
  text?: string;
  html?: string;
  headers?: Map<string, string>;
  to?: unknown;
};

export class EmailAutoReplyApp {
  constructor(
    private readonly client: ImapFlow,
    private readonly transporter: Transporter,
    private readonly groq: Groq,
    private readonly accounts: AccountsService
  ) {
  }

  async run(): Promise<void> {
    await this.client.connect();
    console.log('IMAP connected');

    const lock = await this.client.getMailboxLock('[Gmail]/Tous les messages');
    try {
      const mailbox = await this.client.mailboxOpen('[Gmail]/Tous les messages');
      const start = Math.max(1, mailbox.exists - 4);

      for await (const msg of this.client.fetch(`${start}:*`, { envelope: true })) {
        const subject = msg.envelope?.subject || '(sans sujet)';
        const from = (msg.envelope?.from || [])
          .map(addr => addr.address || addr.name)
          .filter(Boolean)
          .join(', ') || '(expéditeur inconnu)';
        // console.log(`${subject} — ${from}`);
      }

      this.client.on('exists', async (data) => {
        console.log(`[MAIL] New mail detected. Total: ${data.count}`);
        const sequence = `${data.count}:*`;
        for await (const msg of this.client.fetch(sequence, { envelope: true, source: true })) {
          const fromAddress = (msg.envelope?.from || [])
            .map(addr => addr.address)
            .filter((addr): addr is string => Boolean(addr));

          const isNoReply = fromAddress.some(addr =>
            /^(do[-_]?not[-_]?reply|no[-_]?reply)@/i.test(addr)
          );

          if (isNoReply) {
            console.log('[MAIL] No-reply sender ignored.');
            continue;
          }

          if (!msg.source) {
            console.log('[MAIL] Message without content ignored.');
            continue;
          }

          const parsed = await simpleParser(msg.source) as ParsedMailLike;

          const textContent = parsed.text || '';
          const htmlContent = parsed.html || '';
          const detectedLanguage = franc(`${textContent} ${htmlContent}`, { minLength: 20 });
          const language = detectedLanguage === 'fra' ? 'fr' : detectedLanguage === 'eng' ? 'en' : 'fr';

          console.log(`[MAIL] Detected language: ${language}`);

          const headerDeliveredTo = parsed.headers?.get('delivered-to') as string | undefined;
          const headerOriginalTo = parsed.headers?.get('x-original-to') as string | undefined;
          const headerForwardedTo = parsed.headers?.get('x-forwarded-to') as string | undefined;

          const intendedRecipients = this.extractEmails(parsed.to);
          const originalRecipients = this.extractEmails(headerOriginalTo);
          const forwardedRecipients = this.extractEmails(headerForwardedTo);
          const deliveredRecipients = this.extractEmails(headerDeliveredTo);

          const toAddress = (msg.envelope?.to || [])
            .map(addr => addr.address)
            .filter((addr): addr is string => Boolean(addr))
            .map(addr => addr.toLowerCase());

          const targetRecipients = intendedRecipients.length
            ? intendedRecipients
            : originalRecipients.length
              ? originalRecipients
              : forwardedRecipients.length
                ? forwardedRecipients
                : deliveredRecipients.length
                  ? deliveredRecipients
                  : toAddress;

          const matchedAccount = targetRecipients
            .map(addr => this.accounts.findAccountByEmail(addr))
            .find(Boolean);

          if (!matchedAccount) {
            console.log(targetRecipients);
            console.log('[MAIL] No matching account, message ignored.');
            continue;
          }

          const systemPrompt = `${matchedAccount.prompt}\n${this.accounts.getBaseSystemPrompt()}`;

          const matchedRecipient = targetRecipients.find(addr => {
            if (matchedAccount.email instanceof RegExp) {
              return matchedAccount.email.test(addr);
            }
            return matchedAccount.email.toLowerCase() === addr;
          }) || (typeof matchedAccount.email === 'string' ? matchedAccount.email : undefined);

          const replyFrom = matchedRecipient
            ? `${matchedAccount.name} <${matchedRecipient}>`
            : `${matchedAccount.name}`;

          const subject = msg.envelope?.subject || '(sans sujet)';
          const fromDisplay = (msg.envelope?.from || [])
            .map(addr => addr.address || addr.name)
            .filter(Boolean)
            .join(', ') || '(expéditeur inconnu)';

          const timestamp = msg.envelope?.date
            ? new Date(msg.envelope.date).toLocaleString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })
            : 'Date inconnue';

          console.log(`[MAIL] Received (${timestamp}): ${subject} — ${fromDisplay}`);

          console.log('[MAIL] Sender allowed, processing...');
          console.log(`[MAIL] Destination account: ${matchedAccount.name} <${matchedAccount.email}>`);

          const emailContent = [parsed.text, parsed.html]
            .filter((part): part is string => Boolean(part))
            .map(part => part.toString().trim())
            .filter(Boolean)
            .join('\n\n---\n\n');

          const content = [
            `Date d'envoi: ${timestamp}`,
            `De: ${fromDisplay}`,
            `À: ${matchedRecipient || matchedAccount.name}`,
            `Sujet: ${subject}`,
            '',
            emailContent || '(message vide)'
          ].join('\n');

          console.log(`[MAIL] Extracted content (${content.length} characters).`);

          const completion = await this.groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: `${systemPrompt}\nLanguage: ${language}` },
              { role: 'user', content: content || '(message vide)' }
            ],
            temperature: 0.7,
            max_tokens: 200
          });

          const aiReply = completion.choices?.[0]?.message?.content?.trim() || 'salut';
          console.log(`[MAIL] AI reply generated (${aiReply.length} characters).`);

          if (aiReply.includes(MANUAL_REPLY_TRIGGER)) {
            console.log('[MAIL] Manual trigger detected, forwarding.');
            const manualReplyer = process.env.MANUAL_REPLYER;
            if (!manualReplyer) {
              console.error('MANUAL_REPLYER missing.');
              continue;
            }
            await this.transporter.sendMail({
              from: replyFrom,
              to: manualReplyer,
              subject: msg.envelope?.subject ? `FWD: ${msg.envelope.subject}` : 'FWD: (sans sujet)',
              text: [
                'Manual reply required.',
                '',
                `From: ${fromDisplay}`,
                `To: ${(msg.envelope?.to || []).map(addr => addr.address || addr.name).filter(Boolean).join(', ')}`,
                `Subject: ${msg.envelope?.subject || '(sans sujet)'}`,
                '',
                '---',
                unescape(emailContent) || '(message vide)'
              ].join('\n')
            });
            console.log('[MAIL] Message forwarded.');
            continue;
          }

          await this.transporter.sendMail({
            from: replyFrom,
            to: fromAddress.join(', '),
            subject: msg.envelope?.subject ? `Re: ${msg.envelope.subject}` : 'Re: (sans sujet)',
            text: aiReply,
            inReplyTo: msg.envelope?.messageId,
            references: msg.envelope?.messageId ? [msg.envelope.messageId] : undefined
          });
          console.log('[MAIL] Reply sent.');
        }
      });
    } finally {
      lock.release();
    }
  }

  private extractEmails(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(v => this.extractEmails(v));
    if (typeof value === 'string') {
      return (value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
        .map(v => v.toLowerCase());
    }
    if (typeof value === 'object') {
      const typedValue = value as { value?: Array<{ address?: string }>; address?: string; text?: string };
      if (Array.isArray(typedValue.value)) {
        return typedValue.value
          .map(v => v.address)
          .filter((v): v is string => Boolean(v))
          .map(v => v.toLowerCase());
      }
      if (typedValue.address) return [typedValue.address.toLowerCase()];
      if (typedValue.text) return this.extractEmails(typedValue.text);
    }
    return [];
  }
}

decorate(injectable(), EmailAutoReplyApp);
decorate(inject(TYPES.ImapClient), EmailAutoReplyApp, 0);
decorate(inject(TYPES.MailTransporter), EmailAutoReplyApp, 1);
decorate(inject(TYPES.GroqClient), EmailAutoReplyApp, 2);
decorate(inject(TYPES.AccountsService), EmailAutoReplyApp, 3);
