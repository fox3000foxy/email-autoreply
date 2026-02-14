import Groq from "groq-sdk";
import { ImapFlow } from "imapflow";
import { Container } from "inversify";
import nodemailer, { Transporter } from "nodemailer";
import "reflect-metadata";
import { AccountsService } from "../services/AccountsService";
import { ConfigService } from "../services/ConfigService";
import { EmailAutoReplyApp } from "../services/EmailAutoReplyApp";
import { MailboxService } from "../services/MailboxService";
import { TYPES } from "./types";

const container = new Container({ defaultScope: "Singleton" });

container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
container.bind<AccountsService>(TYPES.AccountsService).to(AccountsService).inSingletonScope();
container
  .bind<EmailAutoReplyApp>(TYPES.EmailAutoReplyApp)
  .to(EmailAutoReplyApp);

container.bind<ImapFlow>(TYPES.ImapClient).toDynamicValue((ctx) => {
  const config = ctx.container.get<ConfigService>(TYPES.ConfigService);
  return new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : 993,
    secure: process.env.IMAP_TLS ? process.env.IMAP_TLS === "true" : true,
    logger: false,
    auth: {
      user: config.gmailUser,
      pass: config.gmailPass,
    },
  });
});

container.bind<MailboxService>(TYPES.MailboxService).to(MailboxService).inSingletonScope();

container.bind<Transporter>(TYPES.MailTransporter).toDynamicValue((ctx) => {
  const config = ctx.container.get<ConfigService>(TYPES.ConfigService);
  return nodemailer.createTransport({
    host: process.env.NODEMAILER_HOST || "smtp.gmail.com",
    port: process.env.NODEMAILER_PORT ? Number(process.env.NODEMAILER_PORT) : 587,
    secure: process.env.NODEMAILER_SECURE ? process.env.NODEMAILER_SECURE === "true" : false,
    auth: {
      user: config.gmailUser,
      pass: config.gmailPass,
    },
  });
});

container.bind<Groq>(TYPES.GroqClient).toDynamicValue((ctx) => {
  const config = ctx.container.get<ConfigService>(TYPES.ConfigService);
  return new Groq({ apiKey: config.groqApiKey });
});

export { container };
