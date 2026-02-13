export const TYPES = {
  ConfigService: Symbol.for('ConfigService'),
  AccountsService: Symbol.for('AccountsService'),
  ImapClient: Symbol.for('ImapClient'),
  MailTransporter: Symbol.for('MailTransporter'),
  GroqClient: Symbol.for('GroqClient'),
  EmailAutoReplyApp: Symbol.for('EmailAutoReplyApp')
} as const;
