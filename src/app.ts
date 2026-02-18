import { inject, injectable } from "inversify";
import { AccountEntry, AccountsService } from "./services/AccountsService";
import { ReplyService } from "./services/AIService/ReplyService";
import { SummaryService } from "./services/AIService/SummaryService";
import { ImapService } from "./services/MailService/ImapService";
import { ParserService } from "./services/MailService/ParserService";
import { SmtpService } from "./services/MailService/SmtpService";

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

    async init(): Promise<void> {
        // Use imapService.on() so the listener is re-attached on every reconnect
        this.imapService.on("exists", async (data: { count: number }) => {
            const client = await this.imapService.getFlow();
            console.log(`[MAIL] New mail detected. Total: ${data.count}`);
            const sequence = `${data.count}:*`;
            for await (const msg of client.fetch(sequence, {
                envelope: true,
                source: true,
            })) {
                const fromAddress = (msg.envelope?.from || [])
                    .map((addr) => addr.address)
                    .filter((addr): addr is string => Boolean(addr));

                if (!msg.source) {
                    console.log("[MAIL] Message without content ignored.");
                    continue;
                }

                const parsed = await this.parserService.parseEmail(msg.source);

                // ── Automated / newsletter / info-mail detection ─────────────
                const isAutomatedSender = (addr: string) => {
                    const local = (addr.split("@")[0] || "").toLowerCase();
                    return /^(?:do[-_.]?not[-_.]?reply|no[-_.]?reply|noreply|donotreply|mailer-daemon|postmaster|bounce[s]?|notifications?|news(?:letter)?|info|alert[s]?|digest|updates?|system|admin|webmaster|feedback|service|billing|receipts?|marketing|promo(?:tions?)?|support(?:[-_.+].*)?|help(?:desk)?)/i.test(
                        local,
                    );
                };

                // Header-based detection (Precedence, List-Unsubscribe, Auto-Submitted, X-Auto-Response-Suppress …)
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
                    continue;
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
                    continue;
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
                        .filter(Boolean)
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
                    originalDest: originalDest as string,
                    fromEmail: fromEmailSingle
                });
                console.log(`[MAIL] AI reply generated (${aiReply.length} characters).`);

                // ── AI decided not to reply ──────────────────────────────────
                if (noReply) {
                    console.log("[MAIL] AI decided this email does not need a reply. Skipping.");
                    continue;
                }

                // ── AI decided this needs a human ────────────────────────────
                if (manualTrigger) {
                    console.log("[MAIL] Manual trigger detected, forwarding.");
                    const manualReplyer = process.env.MANUAL_REPLYER;
                    if (!manualReplyer) {
                        console.error("MANUAL_REPLYER missing.");
                        continue;
                    }
                    await this.smtpService.sendManualForward(
                        replyFrom,
                        (msg.envelope?.to || [])
                            .map((addr) => addr.address || addr.name)
                            .filter(Boolean)
                            .join(", "),
                        msg.envelope?.subject || "(sans sujet)",
                        emailContent,
                    );
                    console.log("[MAIL] Message forwarded.");
                    continue;
                }

                // ── Normal AI reply ──────────────────────────────────────────
                await this.smtpService.sendReply(
                    replyFrom,
                    fromAddress,
                    msg.envelope?.subject,
                    aiReply,
                    msg.envelope?.messageId,
                );
                console.log("[MAIL] Reply sent.");
                // Persist the AI reply into conversation memory so the assistant keeps a record
                try {
                    await this.summaryService.updateConversationSummary(
                        originalDest as string,
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
        });
        
        console.log("App initialized and IMAP connection established.");
        await this.smtpService.connect();
        await this.imapService.connect();
    }
}