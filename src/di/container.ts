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

container
  .bind<ConfigService>(TYPES.ConfigService)
  .to(ConfigService)
  .inSingletonScope();
container
  .bind<AccountsService>(TYPES.AccountsService)
  .to(AccountsService)
  .inSingletonScope();
container
  .bind<EmailAutoReplyApp>(TYPES.EmailAutoReplyApp)
  .to(EmailAutoReplyApp);

container.bind<ImapFlow>(TYPES.ImapFlow).toDynamicValue((ctx) => {
  const config = ctx.container.get<ConfigService>(TYPES.ConfigService);
  console.log(
    `[IMAP] Creating IMAP client with config: ${JSON.stringify({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.imapTls,
      user: config.user,
      // pass is intentionally not logged for security reasons
    })}`,
  );
  return new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapTls,
    logger: false,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
});

container
  .bind<MailboxService>(TYPES.MailboxService)
  .to(MailboxService)
  .inSingletonScope();

container.bind<Transporter>(TYPES.MailTransporter).toDynamicValue((ctx) => {
  const config = ctx.container.get<ConfigService>(TYPES.ConfigService);
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
});

container.bind<Groq>(TYPES.GroqClient).toDynamicValue((ctx) => {
  const config = ctx.container.get<ConfigService>(TYPES.ConfigService);
  return new Groq({ apiKey: config.groqApiKey });
});

export { container };
