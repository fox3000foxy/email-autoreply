export const TYPES = {
  ConfigService: Symbol.for("ConfigService"),
  AccountsService: Symbol.for("AccountsService"),
  ImapFlow: Symbol.for("ImapFlow"),
  MailTransporter: Symbol.for("MailTransporter"),
  GroqClient: Symbol.for("GroqClient"),
  MailboxService: Symbol.for("MailboxService"),
  EmailAutoReplyApp: Symbol.for("EmailAutoReplyApp"),
} as const;
