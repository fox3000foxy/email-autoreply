import fs from "fs";
import { injectable } from "inversify";
import path from "path";

export type AccountEntry = {
  name: string;
  email: string | RegExp;
  prompt: string;
  [key: string]: unknown;
};

@injectable()
export class AccountsService {
  private readonly accounts: AccountEntry[];
  private readonly baseSystemPrompt: string;

  constructor() {
    this.accounts = this.loadAccounts();
    this.baseSystemPrompt = fs
      .readFileSync(this.resolveDataPath("base_prompt.txt"), "utf-8")
      .trim();
  }

  getBaseSystemPrompt(): string {
    return this.baseSystemPrompt;
  }

  findAccountByEmail(email?: string): AccountEntry | undefined {
    if (!email) return undefined;

    console.log(`[ACCOUNTS] Looking for account matching email: ${email}`);
    const normalized = email.toLowerCase();
    const normalizedWithoutAlias =
      normalized.split("@")[0].split("+")[0] + "@" + normalized.split("@")[1];
    console.log(`[ACCOUNTS] Normalized email for matching: ${normalizedWithoutAlias}`);
    return this.accounts.find((entry) =>
      entry.email instanceof RegExp
        ? entry.email.test(normalizedWithoutAlias)
        : entry.email.toLowerCase() === normalizedWithoutAlias,
    );
  }

  private resolveDataPath(...segments: string[]) {
    return path.resolve(__dirname, "..", "..", "data", ...segments);
  }

  private loadAccounts(): AccountEntry[] {
    const accountsPath = this.resolveDataPath("accounts.json");
    const raw = fs.readFileSync(accountsPath, "utf-8");
    const parsed = JSON.parse(raw) as Array<
      { name?: string; email?: unknown; prompt?: string } & Record<
        string,
        unknown
      >
    >;

    return parsed.map((entry) => {
      const rawEmail = entry.email;
      let email: string | RegExp;
      if (rawEmail instanceof RegExp) {
        email = rawEmail;
      } else if (
        typeof rawEmail === "string" &&
        rawEmail.startsWith("regex:")
      ) {
        email = new RegExp(rawEmail.replace(/^regex:/, ""));
      } else if (typeof rawEmail === "string") {
        email = rawEmail;
      } else {
        email = String(rawEmail ?? "");
      }

      return {
        ...(entry as AccountEntry),
        email,
      };
    });
  }
}
