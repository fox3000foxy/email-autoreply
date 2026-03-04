import { inject, injectable } from "inversify";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AccountEntry, AccountsService } from "./services/AccountsService";
import { ReplyService } from "./services/AIService/ReplyService";
import { SummaryService } from "./services/AIService/SummaryService";
import { ImapService } from "./services/MailService/ImapService";
import { ParserService } from "./services/MailService/ParserService";
import { SmtpService } from "./services/MailService/SmtpService";

type EnvelopeAddress = {
    address?: string;
    name?: string;
};

type EnvelopeData = {
    from?: EnvelopeAddress[];
    to?: EnvelopeAddress[];
    subject?: string;
    date?: Date;
    messageId?: string;
};

type FetchedMessage = {
    uid?: number;
    source?: Buffer;
    envelope?: EnvelopeData;
};

@injectable()
export class App {
    constructor(
        @inject("ImapService") private imapService: ImapService,
        @inject("SmtpService") private smtpService: SmtpService,
        @inject("ParserService") private parserService: ParserService,
        @inject("SummaryService") private summaryService: SummaryService,
        @inject("ReplyService") private replyService: ReplyService,
        @inject("AccountsService") private accountsService: AccountsService,
    ) {

    }

    private getLastIdPath(): string {
        return path.resolve(process.cwd(), "data", "lastId");
    }

    private async readLastProcessedId(): Promise<number | null> {
        const filePath = this.getLastIdPath();
        try {
            const content = await fs.readFile(filePath, "utf-8");
            const parsedId = Number(content.trim());
            return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
        } catch {
            return null;
        }
    }

    private async writeLastProcessedId(id: number): Promise<void> {
        const filePath = this.getLastIdPath();
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, `${id}\n`, "utf-8");
    }

    private async processMessage(msg: FetchedMessage): Promise<void> {
        const fromAddress = (msg.envelope?.from || [])
            .map((addr) => addr.address)
            .filter((addr): addr is string => Boolean(addr));

        if (!msg.source) {
            console.log("[MAIL] Message without content ignored.");
            return;
        }

        const parsed = await this.parserService.parseEmail(msg.source);

        const isAutomatedSender = (addr: string) => {
            const local = (addr.split("@")[0] || "").toLowerCase();
            return /^(?:do[-_.]?not[-_.]?reply|no[-_.]?reply|noreply|donotreply|mailer-daemon|postmaster|bounce[s]?|notifications?|news(?:letter)?|info|alert[s]?|digest|updates?|system|admin|webmaster|feedback|service|billing|receipts?|marketing|promo(?:tions?)?|support(?:[-_.+].*)?|help(?:desk)?)/i.test(
                local,
            );
        };

        const getHeader = (name: string): string =>
            (parsed.headers?.get(name) ?? "").toString().toLowerCase();

        const precedence = getHeader("precedence");
        const autoSubmitted = getHeader("auto-submitted");
        const listUnsubscribe = getHeader("list-unsubscribe");
        const xAutoResponseSuppress = getHeader("x-auto-response-suppress");
        const xMailer = getHeader("x-mailer");

        const isAutomatedByHeaders =
            ["bulk", "list", "junk"].includes(precedence) ||
            (autoSubmitted !== "" && autoSubmitted !== "no") ||
            listUnsubscribe !== "" ||
            xAutoResponseSuppress !== "" ||
            /mailchimp|sendinblue|brevo|sendgrid|mailgun|amazonses|postmark/i.test(xMailer);

        const isAutomated = fromAddress.some(isAutomatedSender) || isAutomatedByHeaders;
        if (isAutomated) {
            console.log(
                `[MAIL] Automated/newsletter sender ignored (from=${fromAddress.join(", ")}, precedence=${precedence || "none"}, list-unsubscribe=${listUnsubscribe ? "yes" : "no"}).`,
            );
            return;
        }

        const headerDeliveredTo = parsed.headers?.get("delivered-to");
        const headerOriginalTo = parsed.headers?.get("x-original-to");
        const headerForwardedTo = parsed.headers?.get("x-forwarded-to");

        const intendedRecipients = this.parserService.extractEmails(parsed.to);
        const originalRecipients = this.parserService.extractEmails(headerOriginalTo);
        const forwardedRecipients = this.parserService.extractEmails(headerForwardedTo);
        const deliveredRecipients = this.parserService.extractEmails(headerDeliveredTo);

        const toAddress = (msg.envelope?.to || [])
            .map((addr) => addr.address)
            .filter((addr): addr is string => Boolean(addr))
            .map((addr) => addr.toLowerCase());

        const targetRecipients = [
            intendedRecipients,
            originalRecipients,
            forwardedRecipients,
            deliveredRecipients,
        ].find((recipients) => recipients.length > 0) || toAddress;

        const matchedAccount = targetRecipients
            .map((addr: string): AccountEntry | undefined => this.accountsService.findAccountByEmail(addr))
            .find((addr: AccountEntry | undefined) => addr !== undefined);

        if (!matchedAccount) {
            console.log("[MAIL] No matching account, message ignored.");
            return;
        }

        const matchedRecipient = matchedAccount.originalEmail;
        console.log(`[MAIL] Matched recipient: ${matchedRecipient || "N/A"}`);

        const replyFrom = matchedRecipient
            ? `${matchedAccount.name} <${matchedRecipient}>`
            : `${matchedAccount.name}`;

        const subject = msg.envelope?.subject || "(sans sujet)";
        const fromDisplay =
            (msg.envelope?.from || [])
                .map((addr) => addr.address || addr.name)
                .filter((value): value is string => Boolean(value))
                .join(", ") || "(expéditeur inconnu)";

        const timestamp = msg.envelope?.date
            ? new Date(msg.envelope.date).toLocaleString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            })
            : "Date inconnue";

        console.log(
            `[MAIL] Received (${timestamp}): ${subject} — ${fromDisplay}`,
        );
        console.log("[MAIL] Sender allowed, processing...");
        console.log(
            `[MAIL] Destination account: ${matchedAccount.name} <${matchedAccount.email}>`,
        );

        const emailContent = [parsed.text, parsed.html]
            .filter((part): part is string => Boolean(part))
            .map((part) => part.toString().trim())
            .filter(Boolean)
            .join("\n\n---\n\n");

        const content = [
            `Date d'envoi: ${timestamp}`,
            `De: ${fromDisplay}`,
            `À: ${matchedRecipient || matchedAccount.name}`,
            `Sujet: ${subject}`,
            "",
            emailContent || "(message vide)",
        ].join("\n");

        console.log(`[MAIL] Extracted content (${content.length} characters).`);

        const originalDest =
            matchedRecipient ||
            (typeof matchedAccount.email === "string"
                ? matchedAccount.email
                : matchedAccount.name);

        const fromEmailSingle = fromAddress[0] || fromDisplay;

        const { aiReply, manualTrigger, noReply } = await this.replyService.generateReply({
            content,
            personaPrompt: matchedAccount.prompt,
            originalDest,
            fromEmail: fromEmailSingle,
        });
        console.log(`[MAIL] AI reply generated (${aiReply.length} characters).`);

        if (noReply) {
            console.log("[MAIL] AI decided this email does not need a reply. Skipping.");
            return;
        }

        if (manualTrigger) {
            console.log("[MAIL] Manual trigger detected, forwarding.");
            const manualReplyer = process.env.MANUAL_REPLYER;
            if (!manualReplyer) {
                console.error("MANUAL_REPLYER missing.");
                return;
            }
            await this.smtpService.sendManualForward(
                replyFrom,
                (msg.envelope?.to || [])
                    .map((addr) => addr.address || addr.name)
                    .filter((value): value is string => Boolean(value))
                    .join(", "),
                msg.envelope?.subject || "(sans sujet)",
                emailContent,
            );
            console.log("[MAIL] Message forwarded.");
            return;
        }

        await this.smtpService.sendReply(
            replyFrom,
            fromAddress,
            msg.envelope?.subject,
            aiReply,
            msg.envelope?.messageId,
        );
        console.log("[MAIL] Reply sent.");

        try {
            await this.summaryService.updateConversationSummary(
                originalDest,
                fromEmailSingle,
                `AI reply:\n${aiReply}`,
            );
        } catch (err) {
            console.error(
                "[MAIL] Failed to update conversation memory with AI reply.",
                err,
            );
        }
    }

    private async processActionBatch(): Promise<void> {
        const client = await this.imapService.getFlow();
        await client.connect();

        let lock: { release: () => void } | null = null;
        try {
            const mailboxName = await this.imapService.findAllMailMailbox();
            lock = await client.getMailboxLock(mailboxName);

            const lastProcessedId = await this.readLastProcessedId();
            process.stderr.write(`[ACTION] Starting batch processing with lastId=${lastProcessedId}`);
            if (lastProcessedId === null) {
                let latestSeenUid = 0;
                for await (const msg of client.fetch("*", {
                    uid: true,
                })) {
                    latestSeenUid = Math.max(latestSeenUid, msg.uid || 0);
                    break;
                }
                await this.writeLastProcessedId(latestSeenUid);
                process.stderr.write(
                    `[ACTION] Initialization complete. lastId set to latest UID ${latestSeenUid}.`,
                );
                return;
            }

            // console.log(`[ACTION] Last processed UID: ${lastProcessedId}`);

            // let latestSeenUid = lastProcessedId;
            // for await (const msg of client.fetch("1:*", {
            //     uid: true,
            //     envelope: true,
            //     source: true,
            // })) {
            //     const typedMsg: FetchedMessage = {
            //         uid: msg.uid,
            //         envelope: msg.envelope,
            //         source: msg.source,
            //     };

            //     const currentUid = typedMsg.uid ?? 0;
            //     if (currentUid <= lastProcessedId) {
            //         continue;
            //     }

            //     await this.processMessage(typedMsg);
            //     latestSeenUid = Math.max(latestSeenUid, currentUid);
            // }

            // if (latestSeenUid !== lastProcessedId) {
            //     await this.writeLastProcessedId(latestSeenUid);
            //     console.log(`[ACTION] Updated lastId to UID ${latestSeenUid}.`);
            // } else {
            //     console.log("[ACTION] No new message after lastId.");
            // }
        } finally {
            if (lock) {
                try {
                    lock.release();
                } catch {
                    // Ignore release errors.
                }
            }
            await this.imapService.disconnect();
        }
    }

    async init(options?: { actionMode?: boolean }): Promise<void> {
        await this.smtpService.connect();

        if (options?.actionMode) {
            process.stderr.write("[ACTION] Running in --action mode (no IMAP listener).\n");
            await this.processActionBatch();
            await this.smtpService.disconnect();
            return;
        }

        this.imapService.on("exists", async (data: { count: number }) => {
            const client = await this.imapService.getFlow();
            console.log(`[MAIL] New mail detected. Total: ${data.count}`);
            const sequence = `${data.count}:*`;
            for await (const msg of client.fetch(sequence, {
                envelope: true,
                source: true,
            })) {
                const typedMsg: FetchedMessage = {
                    uid: msg.uid,
                    envelope: msg.envelope,
                    source: msg.source,
                };
                await this.processMessage(typedMsg);
            }
        });

        console.log("App initialized and IMAP connection established.");
        await this.imapService.connect();
    }
}