import { ImapFlow, ListResponse } from "imapflow";
import { inject, injectable } from "inversify";
import { TYPES } from "../../types";
import { ConfigService } from "../ConfigService";

@injectable()
export class ImapService {
    private client: ImapFlow | null = null;

    constructor(
        @inject(TYPES.ConfigService) private configService: ConfigService,
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
        const client = await this.getFlow();
        client.connect();
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
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