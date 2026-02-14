import Groq from 'groq-sdk';
import { ImapFlow } from 'imapflow';
import { Container } from 'inversify';
import nodemailer, { Transporter } from 'nodemailer';
import 'reflect-metadata';
import { AccountsService } from '../services/AccountsService';
import { ConfigService } from '../services/ConfigService';
import { EmailAutoReplyApp } from '../services/EmailAutoReplyApp';
import { TYPES } from './types';

const container = new Container({ defaultScope: 'Singleton' });

container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService);
container.bind<AccountsService>(TYPES.AccountsService).to(AccountsService);
container.bind<EmailAutoReplyApp>(TYPES.EmailAutoReplyApp).to(EmailAutoReplyApp);

container.bind<ImapFlow>(TYPES.ImapClient).toDynamicValue((ctx) => {
  const config = ctx.container.get<ConfigService>(TYPES.ConfigService);
  return new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    logger: false,
    auth: {
      user: config.gmailUser,
      pass: config.gmailPass
    }
  });
});

container.bind<Transporter>(TYPES.MailTransporter).toDynamicValue((ctx) => {
  const config = ctx.container.get<ConfigService>(TYPES.ConfigService);
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmailUser,
      pass: config.gmailPass
    }
  });
});

container.bind<Groq>(TYPES.GroqClient).toDynamicValue((ctx) => {
  const config = ctx.container.get<ConfigService>(TYPES.ConfigService);
  return new Groq({ apiKey: config.groqApiKey });
});

export { container };
