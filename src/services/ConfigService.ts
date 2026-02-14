import dotenv from "dotenv";
import { injectable } from "inversify";
import path from "path";

@injectable()
export class ConfigService {
  constructor() {
    dotenv.config({ path: path.join(process.cwd(), ".env") });
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`${key} manquant.`);
    }
    return value;
  }

  get user(): string {
    return this.requireEnv("MAILUSER");
  }

  get pass(): string {
    return this.requireEnv("MAILPASS");
  }

  get groqApiKey(): string {
    return this.requireEnv("GROQ_API_KEY");
  }

  get imapHost(): string {
    return process.env.IMAP_HOST || "imap.gmail.com";
  }

  get imapPort(): number {
    return process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : 993;
  }

  get imapTls(): boolean {
    return process.env.IMAP_TLS ? process.env.IMAP_TLS === "true" : true;
  }

  get smtpHost(): string {
    return process.env.NODEMAILER_HOST || "smtp.gmail.com";
  }

  get smtpPort(): number {
    return process.env.NODEMAILER_PORT ? Number(process.env.NODEMAILER_PORT) : 587;
  }

  get smtpSecure(): boolean {
    return process.env.NODEMAILER_SECURE ? process.env.NODEMAILER_SECURE === "true" : false;
  }
}
