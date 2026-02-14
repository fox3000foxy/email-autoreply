import { ImapFlow, ListResponse } from "imapflow";
import { inject, injectable } from "inversify";
import { ConfigService } from "../ConfigService";

@injectable()
export class ImapService {
    private client: ImapFlow | null = null;

    constructor(
        @inject("ConfigService") private configService: ConfigService
    ) {
        this.client = null;
    }

    async getFlow(): Promise<ImapFlow> {
        if (!this.client) {
            this.client = new ImapFlow({
                host: this.configService.imapHost,
                port: this.configService.imapPort,
                secure: this.configService.imapTls,
                logger: false,
                auth: {
                    user: this.configService.user,
                    pass: this.configService.pass,
                },
            });
        }
        return this.client;
    }

    async connect(): Promise<void> {
        console.log("Connecting to IMAP server...");
        const client = await this.getFlow();
        await client.connect();
        console.log("IMAP connected");
        const mailboxName = await this.findAllMailMailbox();
        console.log(`Using mailbox: ${mailboxName}`);
        const lock = await client.getMailboxLock(mailboxName);
        try {
            console.log(
                "Entering IMAP IDLE loop to receive new messages (keeps mailbox lock).",
            );
            // Ajout d'un polling NOOP toutes les 10 secondes pendant l'IDLE
            while (true) {
                let idlePromise;
                let noopInterval;
                try {
                    idlePromise = client.idle();
                    noopInterval = setInterval(async () => {
                        try {
                            await client.noop();
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

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.logout();
            this.client = null;
        }
    }

    async findAllMailMailbox(): Promise<string> {
        // Try to list all mailboxes from the server
        let listResult: ListResponse[];
        const client = await this.getFlow();
        try {
            // ImapFlow.list signature can vary between versions; call without args to be safe
            listResult = await client.list();
            console.log(
                `[MAILBOX] Retrieved ${Array.isArray(listResult) ? listResult.length : 0} mailboxes from server.`,
            );
        } catch (err) {
            console.error("[MAILBOX] Error retrieving mailboxes:", err);
            return "[Gmail]/All Mail";
        }

        // Fallback: try common localized names
        const nameRegex =
            /\b(all mail|tous les messages|alle nachrichten|todos los mensajes|todos os emails|すべてのメール|全てのメール|вся почта)\b/i;
        for (const m of listResult) {
            const candidate = (m.path || m.name || "").toString();
            if (nameRegex.test(candidate)) return candidate;
        }

        // As a last resort, try to find the mailbox under the [Gmail] namespace
        for (const m of listResult) {
            const candidate = (m.path || m.name || "").toString();
            if (/^\[gmail\]\//i.test(candidate)) {
                if (nameRegex.test(candidate)) return candidate;
            }
        }

        // Give up and return a reasonable default used by many setups
        return "[Gmail]/All Mail";
    }
}