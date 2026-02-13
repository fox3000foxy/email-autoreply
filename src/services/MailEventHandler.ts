import type Groq from 'groq-sdk';
import type { ImapFlow } from 'imapflow';
import type { Transporter } from 'nodemailer';

import { AccountsService } from './AccountsService';
import { updateConversationSummary } from './ConversationMemory';
import { extractEmails, parseEmail } from './EmailParser';
import { detectLanguage } from './LanguageDetector';
import { sendManualForward, sendReply } from './MailSender';
import { generateReply } from './ReplyGenerator';

export function attachMailExistsHandler(
    client: ImapFlow,
    transporter: Transporter,
    groq: Groq,
    accounts: AccountsService
): void {
    client.on('exists', async (data) => {
        console.log(`[MAIL] New mail detected. Total: ${data.count}`);
        const sequence = `${data.count}:*`;
        for await (const msg of client.fetch(sequence, { envelope: true, source: true })) {
            const fromAddress = (msg.envelope?.from || [])
                .map(addr => addr.address)
                .filter((addr): addr is string => Boolean(addr));

            const isNoReply = fromAddress.some(addr => /^(do[-_]?not[-_]?reply|no[-_]?reply)@/i.test(addr));
            if (isNoReply) {
                console.log('[MAIL] No-reply sender ignored.');
                continue;
            }

            if (!msg.source) {
                console.log('[MAIL] Message without content ignored.');
                continue;
            }

            const parsed = await parseEmail(msg.source);

            const textContent = parsed.text || '';
            const htmlContent = parsed.html || '';
            const language = detectLanguage(textContent, htmlContent);
            console.log(`[MAIL] Detected language: ${language}`);

            const headerDeliveredTo = parsed.headers?.get('delivered-to') as string | undefined;
            const headerOriginalTo = parsed.headers?.get('x-original-to') as string | undefined;
            const headerForwardedTo = parsed.headers?.get('x-forwarded-to') as string | undefined;

            const intendedRecipients = extractEmails(parsed.to);
            const originalRecipients = extractEmails(headerOriginalTo);
            const forwardedRecipients = extractEmails(headerForwardedTo);
            const deliveredRecipients = extractEmails(headerDeliveredTo);

            const toAddress = (msg.envelope?.to || [])
                .map(addr => addr.address)
                .filter((addr): addr is string => Boolean(addr))
                .map(addr => addr.toLowerCase());

            const targetRecipients = intendedRecipients.length
                ? intendedRecipients
                : originalRecipients.length
                    ? originalRecipients
                    : forwardedRecipients.length
                        ? forwardedRecipients
                        : deliveredRecipients.length
                            ? deliveredRecipients
                            : toAddress;

            const matchedAccount = targetRecipients
                .map(addr => accounts.findAccountByEmail(addr))
                .find(Boolean);

            if (!matchedAccount) {
                console.log('[MAIL] No matching account, message ignored.');
                continue;
            }

            const systemPrompt = `${matchedAccount.prompt}\n${accounts.getBaseSystemPrompt()}`;

            const matchedRecipient = targetRecipients.find(addr => {
                if (matchedAccount.email instanceof RegExp) return matchedAccount.email.test(addr);
                return matchedAccount.email.toLowerCase() === addr;
            }) || (typeof matchedAccount.email === 'string' ? matchedAccount.email : undefined);

            const replyFrom = matchedRecipient ? `${matchedAccount.name} <${matchedRecipient}>` : `${matchedAccount.name}`;

            const subject = msg.envelope?.subject || '(sans sujet)';
            const fromDisplay = (msg.envelope?.from || [])
                .map(addr => addr.address || addr.name)
                .filter(Boolean)
                .join(', ') || '(expéditeur inconnu)';

            const timestamp = msg.envelope?.date
                ? new Date(msg.envelope.date).toLocaleString('fr-FR', {
                    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                })
                : 'Date inconnue';

            console.log(`[MAIL] Received (${timestamp}): ${subject} — ${fromDisplay}`);
            console.log('[MAIL] Sender allowed, processing...');
            console.log(`[MAIL] Destination account: ${matchedAccount.name} <${matchedAccount.email}>`);

            const emailContent = [parsed.text, parsed.html]
                .filter((part): part is string => Boolean(part))
                .map(part => part.toString().trim())
                .filter(Boolean)
                .join('\n\n---\n\n');

            const content = [
                `Date d'envoi: ${timestamp}`,
                `De: ${fromDisplay}`,
                `À: ${matchedRecipient || matchedAccount.name}`,
                `Sujet: ${subject}`,
                '',
                emailContent || '(message vide)'
            ].join('\n');

            console.log(`[MAIL] Extracted content (${content.length} characters).`);

            const originalDest = matchedRecipient || (typeof matchedAccount.email === 'string' ? matchedAccount.email : matchedAccount.name);

            const fromEmailSingle = fromAddress[0] || fromDisplay;

            const conversationSummary = await updateConversationSummary(groq, originalDest, fromEmailSingle, content);

            const { aiReply, manualTrigger } = await generateReply(groq, systemPrompt, content, language, conversationSummary);
            console.log(`[MAIL] AI reply generated (${aiReply.length} characters).`);

            if (manualTrigger) {
                console.log('[MAIL] Manual trigger detected, forwarding.');
                const manualReplyer = process.env.MANUAL_REPLYER;
                if (!manualReplyer) {
                    console.error('MANUAL_REPLYER missing.');
                    continue;
                }
                await sendManualForward(transporter, replyFrom, manualReplyer,
                    (msg.envelope?.to || []).map(addr => addr.address || addr.name).filter(Boolean).join(', '),
                    msg.envelope?.subject || '(sans sujet)', emailContent);
                console.log('[MAIL] Message forwarded.');
                continue;
            }

            await sendReply(transporter, replyFrom, fromAddress, msg.envelope?.subject, aiReply, msg.envelope?.messageId);
            console.log('[MAIL] Reply sent.');
            // Persist the AI reply into conversation memory so the assistant keeps a record
            try {
                await updateConversationSummary(groq, originalDest, fromEmailSingle, `AI reply:\n${aiReply}`);
            } catch (err) {
                console.error('[MAIL] Failed to update conversation memory with AI reply.', err);
            }
        }
    });
}
