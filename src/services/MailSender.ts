import type { Transporter } from "nodemailer";

export async function sendManualForward(
  transporter: Transporter,
  from: string,
  manualReplyer: string,
  envelopeTo: string,
  subject: string,
  emailContent: string,
): Promise<void> {
  await transporter.sendMail({
    from,
    to: manualReplyer,
    subject: subject ? `FWD: ${subject}` : "FWD: (sans sujet)",
    text: [
      "Manual reply required.",
      "",
      `From: ${from}`,
      `To: ${envelopeTo}`,
      `Subject: ${subject || "(sans sujet)"}`,
      "",
      "---",
      unescape(emailContent) || "(message vide)",
    ].join("\n"),
  });
}

export async function sendReply(
  transporter: Transporter,
  from: string,
  to: string[] | string,
  subject: string | undefined,
  aiReply: string,
  inReplyTo?: string,
): Promise<void> {
  await transporter.sendMail({
    from,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject: subject ? `Re: ${subject}` : "Re: (sans sujet)",
    text: aiReply,
    inReplyTo,
    references: inReplyTo ? [inReplyTo] : undefined,
  });
}
