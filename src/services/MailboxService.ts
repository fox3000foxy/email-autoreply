import type { ImapFlow } from "imapflow";
import { findAllMailMailbox } from "./MailboxUtils";

export class MailboxService {
    async findAllMailMailbox(client: ImapFlow): Promise<string> {
        return findAllMailMailbox(client);
    }
}
