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
    return this.requireEnv("IMAP_HOST");
  }

  get imapPort(): number {
    return this.requireEnv("IMAP_PORT") ? Number(this.requireEnv("IMAP_PORT")) : 993;  }

  get imapTls(): boolean {
    return this.requireEnv("IMAP_TLS") === "true";
  }

  get smtpHost(): string {
    return this.requireEnv("NODEMAILER_HOST") || "smtp.gmail.com";
  }

  get smtpPort(): number {
    return this.requireEnv("NODEMAILER_PORT")
      ? Number(this.requireEnv("NODEMAILER_PORT"))
      : 587;
  }

  get smtpSecure(): boolean {
    return this.requireEnv("NODEMAILER_SECURE")
      ? this.requireEnv("NODEMAILER_SECURE") === "true"
      : false;
  }

  get manualReplyer(): string {
    return this.requireEnv("MANUAL_REPLYER");
  }
}
