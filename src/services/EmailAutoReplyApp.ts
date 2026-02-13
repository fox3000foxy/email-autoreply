import type Groq from 'groq-sdk';
import type { ImapFlow } from 'imapflow';
import { decorate, inject, injectable } from 'inversify';
import type { Transporter } from 'nodemailer';

import { TYPES } from '../di/types';
import { AccountsService } from './AccountsService';
import { attachMailExistsHandler } from './MailEventHandler';
import { findAllMailMailbox } from './MailboxUtils';

export class EmailAutoReplyApp {
  constructor(
    private readonly client: ImapFlow,
    private readonly transporter: Transporter,
    private readonly groq: Groq,
    private readonly accounts: AccountsService
  ) {}

  async run(): Promise<void> {
    await this.client.connect();
    console.log('IMAP connected');
    const mailboxName = await findAllMailMailbox(this.client);
    console.log(`Using mailbox: ${mailboxName}`);
    const lock = await this.client.getMailboxLock(mailboxName);
    try {
      attachMailExistsHandler(this.client, this.transporter, this.groq, this.accounts);
    } finally {
      lock.release();
    }
  }
}

decorate(injectable(), EmailAutoReplyApp);
decorate(inject(TYPES.ImapClient), EmailAutoReplyApp, 0);
decorate(inject(TYPES.MailTransporter), EmailAutoReplyApp, 1);
decorate(inject(TYPES.GroqClient), EmailAutoReplyApp, 2);
decorate(inject(TYPES.AccountsService), EmailAutoReplyApp, 3);
