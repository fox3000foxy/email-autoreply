import type Groq from "groq-sdk";
import type { ImapFlow } from "imapflow";
import { inject } from "inversify";
import type { Transporter } from "nodemailer";

import { TYPES } from "../di/types";
import { AccountsService } from "./AccountsService";
import { attachMailExistsHandler } from "./MailEventHandler";
import { MailboxService } from "./MailboxService";

export class EmailAutoReplyApp {
  constructor(
    @inject(TYPES.ImapFlow) private readonly client: ImapFlow,
    @inject(TYPES.MailTransporter) private readonly transporter: Transporter,
    @inject(TYPES.GroqClient) private readonly groq: Groq,
    @inject(TYPES.AccountsService) private readonly accounts: AccountsService,
    @inject(TYPES.MailboxService)
    private readonly mailboxService: MailboxService,
  ) {}

  async run(): Promise<void> {
    await this.client.connect();
    console.log("IMAP connected");
    const mailboxName = await this.mailboxService.findAllMailMailbox();
    console.log(`Using mailbox: ${mailboxName}`);
    const lock = await this.client.getMailboxLock(mailboxName);
    try {
      attachMailExistsHandler(
        this.client,
        this.transporter,
        this.groq,
        this.accounts,
      );
      console.log(
        "Entering IMAP IDLE loop to receive new messages (keeps mailbox lock).",
      );
      // Ajout d'un polling NOOP toutes les 10 secondes pendant l'IDLE
      while (true) {
        let idlePromise;
        let noopInterval;
        try {
          idlePromise = this.client.idle();
          noopInterval = setInterval(async () => {
            try {
              await this.client.noop();
              // console.log('[IMAP] NOOP sent');
            } catch (e) {
              console.error("[IMAP] NOOP error", e);
            }
          }, 3000); // 3 secondes
          await idlePromise;
        } catch (err) {
          console.error("[IMAP] IDLE error, retrying in 5s", err);
          await new Promise((res) => setTimeout(res, 5000));
        } finally {
          if (noopInterval) clearInterval(noopInterval);
        }
      }
    } finally {
      lock.release();
    }
  }
}
