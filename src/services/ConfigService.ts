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

  get gmailUser(): string {
    return this.requireEnv("GMAIL_USER");
  }

  get gmailPass(): string {
    return this.requireEnv("GMAIL_PASS");
  }

  get groqApiKey(): string {
    return this.requireEnv("GROQ_API_KEY");
  }
}
