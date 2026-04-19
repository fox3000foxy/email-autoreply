import { inject, injectable } from "inversify";
import nodemailer from "nodemailer";
import type { ConfigService } from "../ConfigService";

@injectable()
export class SmtpService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(@inject("ConfigService") private configService: ConfigService) {
    this.configService = configService;
  }

  async connect(): Promise<void> {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.smtpHost,
        port: this.configService.smtpPort,
        secure: this.configService.smtpSecure,
        auth: {
          user: this.configService.user,
          pass: this.configService.pass,
        },
      });
    }
  }

  async disconnect(): Promise<void> {
    // Nodemailer doesn't have a built-in disconnect method, but if using a connection pool, you can close it
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }

  async sendMail(options: nodemailer.SendMailOptions): Promise<void> {
    if (!this.transporter) {
      throw new Error(
        "SMTP transporter is not initialized. Call connect() first.",
      );
    }

    await this.transporter.sendMail(options);
  }

  get manualReplyer(): string {
    return this.configService.manualReplyer || this.configService.user;
  }

  async sendManualForward(
    from: string,
    envelopeTo: string,
    subject: string,
    emailContent: string,
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error(
        "SMTP transporter is not initialized. Call connect() first.",
      );
    }
    await this.transporter.sendMail({
      from,
      to: this.manualReplyer,
      subject: subject ? `FWD: ${subject}` : "FWD: (sans sujet)",
      html: [
        "<strong>Manual reply required.</strong>",
        "",
        `<strong>From: ${from}</strong>`,
        `<strong>To: ${envelopeTo}</strong>`,
        `<strong>Subject: ${subject || "(sans sujet)"}</strong>`,
        "",
        "---",
        emailContent || "(message vide)",
      ].join("\n"),
    });
  }

  async sendReply(
    from: string,
    to: string[] | string,
    subject: string | undefined,
    aiReply: string,
    inReplyTo?: string,
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error(
        "SMTP transporter is not initialized. Call connect() first.",
      );
    }
    await this.transporter.sendMail({
      from,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject: subject ? `Re: ${subject}` : "Re: (sans sujet)",
      text: aiReply,
      inReplyTo,
      references: inReplyTo ? [inReplyTo] : undefined,
    });
  }
}
