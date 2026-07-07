"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const inversify_1 = require("inversify");
const LastIdService_1 = require("./services/LastIdService");
const MailUtils_1 = require("./utils/MailUtils");
let App = class App {
    imapService;
    smtpService;
    parserService;
    summaryService;
    replyService;
    accountsService;
    constructor(imapService, smtpService, parserService, summaryService, replyService, accountsService) {
        this.imapService = imapService;
        this.smtpService = smtpService;
        this.parserService = parserService;
        this.summaryService = summaryService;
        this.replyService = replyService;
        this.accountsService = accountsService;
        this.imapService = imapService;
        this.smtpService = smtpService;
        this.parserService = parserService;
        this.summaryService = summaryService;
        this.replyService = replyService;
        this.accountsService = accountsService;
    }
    lastIdService = new LastIdService_1.LastIdService();
    async processMessage(msg) {
        const fromAddress = (msg.envelope?.from || [])
            .map((addr) => addr.address)
            .filter((addr) => Boolean(addr));
        if (!msg.source) {
            console.log("[MAIL] Message without content ignored.");
            return;
        }
        const parsed = await this.parserService.parseEmail(msg.source);
        // Prepare headers for utility
        const headersObj = {};
        [
            "precedence",
            "auto-submitted",
            "list-unsubscribe",
            "x-auto-response-suppress",
            "x-mailer",
        ].forEach((name) => {
            // eslint-disable-next-line security/detect-object-injection
            headersObj[name] = (parsed.headers?.get(name) ?? "")
                .toString()
                .toLowerCase();
        });
        const isAutomated = fromAddress.some(MailUtils_1.isAutomatedSender) || (0, MailUtils_1.isAutomatedByHeaders)(headersObj);
        if (isAutomated) {
            console.log(`[MAIL] Automated/newsletter sender ignored (from=${fromAddress.join(", ")}, precedence=${headersObj.precedence || "none"}, list-unsubscribe=${headersObj["list-unsubscribe"] ? "yes" : "no"}).`);
            return;
        }
        const headerDeliveredTo = parsed.headers?.get("delivered-to");
        const headerOriginalTo = parsed.headers?.get("x-original-to");
        const headerForwardedTo = parsed.headers?.get("x-forwarded-to");
        const intendedRecipients = this.parserService
            .extractEmails(parsed.to)
            .filter(MailUtils_1.isValidEmail);
        const originalRecipients = this.parserService
            .extractEmails(headerOriginalTo)
            .filter(MailUtils_1.isValidEmail);
        const forwardedRecipients = this.parserService
            .extractEmails(headerForwardedTo)
            .filter(MailUtils_1.isValidEmail);
        const deliveredRecipients = this.parserService
            .extractEmails(headerDeliveredTo)
            .filter(MailUtils_1.isValidEmail);
        const toAddress = (msg.envelope?.to || [])
            .map((addr) => addr.address)
            .filter((addr) => Boolean(addr))
            .filter(MailUtils_1.isValidEmail)
            .map((addr) => addr.toLowerCase());
        const targetRecipients = [
            intendedRecipients,
            originalRecipients,
            forwardedRecipients,
            deliveredRecipients,
        ].find((recipients) => recipients.length > 0) || toAddress;
        const matchedAccount = targetRecipients
            .map((addr) => this.accountsService.findAccountByEmail(addr))
            .find((addr) => addr !== undefined);
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
        const fromDisplay = (msg.envelope?.from || [])
            .map((addr) => addr.address || addr.name)
            .filter((value) => Boolean(value))
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
        console.log(`[MAIL] Received (${timestamp}): ${subject} — ${fromDisplay}`);
        console.log("[MAIL] Sender allowed, processing...");
        console.log(`[MAIL] Destination account: ${matchedAccount.name} <${matchedAccount.email}>`);
        const emailContent = [parsed.text, parsed.html]
            .filter((part) => Boolean(part))
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
        const originalDest = matchedRecipient ||
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
            await this.smtpService.sendManualForward(replyFrom, (msg.envelope?.to || [])
                .map((addr) => addr.address || addr.name)
                .filter((value) => Boolean(value))
                .join(", "), msg.envelope?.subject || "(sans sujet)", emailContent);
            console.log("[MAIL] Message forwarded.");
            return;
        }
        await this.smtpService.sendReply(replyFrom, fromAddress, msg.envelope?.subject, aiReply, msg.envelope?.messageId);
        console.log("[MAIL] Reply sent.");
        try {
            await this.summaryService.updateConversationSummary(originalDest, fromEmailSingle, `AI reply:\n${aiReply}`);
        }
        catch (err) {
            console.error("[MAIL] Failed to update conversation memory with AI reply.", err);
        }
    }
    async processActionBatch() {
        const client = await this.imapService.getFlow();
        await client.connect();
        let lock = null;
        try {
            const mailboxName = await this.imapService.findAllMailMailbox();
            lock = await client.getMailboxLock(mailboxName);
            const lastProcessedId = await this.lastIdService.read();
            process.stderr.write(`[ACTION] Starting batch processing with lastId=${lastProcessedId}`);
            if (lastProcessedId === null) {
                let latestSeenUid = 0;
                const mailbox = await client.mailboxOpen(mailboxName);
                if (mailbox.exists > 0) {
                    const seq = `${mailbox.exists}:*`;
                    for await (const msg of client.fetch(seq, { uid: true })) {
                        latestSeenUid = msg.uid || 0;
                        break;
                    }
                }
                await this.lastIdService.write(latestSeenUid);
                process.stderr.write(`[ACTION] Initialization complete. lastId set to latest UID ${latestSeenUid}.`);
                return;
            }
            process.stderr.write(`[ACTION] Last processed UID: ${lastProcessedId}`);
            let latestSeenUid = lastProcessedId;
            const uidRange = `${lastProcessedId + 1}:*`;
            for await (const msg of client.fetch(uidRange, {
                uid: true,
                envelope: true,
                source: true,
            }, {
                uid: true,
            })) {
                const typedMsg = {
                    uid: msg.uid,
                    envelope: msg.envelope,
                    source: msg.source,
                };
                const currentUid = typedMsg.uid ?? 0;
                if (currentUid <= lastProcessedId) {
                    continue;
                }
                await this.processMessage(typedMsg);
                latestSeenUid = Math.max(latestSeenUid, currentUid);
            }
            if (latestSeenUid !== lastProcessedId) {
                await this.lastIdService.write(latestSeenUid);
                process.stderr.write(`[ACTION] Updated lastId to UID ${latestSeenUid}.`);
            }
            else {
                process.stderr.write(`[ACTION] No new message after lastId.`);
            }
        }
        finally {
            if (lock) {
                try {
                    lock.release();
                }
                catch {
                    // Ignore release errors.
                }
            }
            await this.imapService.disconnect();
        }
    }
    async init(options) {
        await this.smtpService.connect();
        if (options?.actionMode) {
            process.stderr.write("[ACTION] Running in --action mode (no IMAP listener).\n");
            await this.processActionBatch();
            await this.smtpService.disconnect();
            return;
        }
        this.imapService.on("exists", async (data) => {
            const client = await this.imapService.getFlow();
            console.log(`[MAIL] New mail detected. Total: ${data.count}`);
            const sequence = `${data.count}:*`;
            for await (const msg of client.fetch(sequence, {
                envelope: true,
                source: true,
            })) {
                const typedMsg = {
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
};
exports.App = App;
exports.App = App = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("ImapService")),
    __param(1, (0, inversify_1.inject)("SmtpService")),
    __param(2, (0, inversify_1.inject)("ParserService")),
    __param(3, (0, inversify_1.inject)("SummaryService")),
    __param(4, (0, inversify_1.inject)("ReplyService")),
    __param(5, (0, inversify_1.inject)("AccountsService")),
    __metadata("design:paramtypes", [Function, Function, Function, Function, Function, Function])
], App);
