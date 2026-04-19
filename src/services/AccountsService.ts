import fs from "node:fs";
import { injectable } from "inversify";
import path from "node:path";

export type AccountEntry = {
	name: string;
	email: string | RegExp;
	prompt: string;
	originalEmail: string;
	[key: string]: unknown;
};

@injectable()
export class AccountsService {
	public readonly accounts: AccountEntry[];
	constructor() {
		this.accounts = this.loadAccounts();
	}

	public findAccountByEmail(email?: string): AccountEntry | undefined {
		if (!email) return undefined;

		console.log(`[ACCOUNTS] Looking for account matching email: ${email}`);
		const normalized = email.toLowerCase();
		const normalizedWithoutAlias = `${normalized.split("@")[0].split("+")[0]}@${normalized.split("@")[1]}`;
		console.log(
			`[ACCOUNTS] Normalized email for matching: ${normalizedWithoutAlias}`,
		);
		const isExisting = this.accounts.find((entry) =>
			entry.email instanceof RegExp
				? entry.email.test(normalizedWithoutAlias)
				: entry.email.toLowerCase() === normalizedWithoutAlias,
		);
		if (isExisting) {
			console.log(
				`[ACCOUNTS] Found matching account: ${isExisting.name} <${isExisting.email}>`,
			);
			return {
				...isExisting,
				originalEmail: email,
			};
		} else {
			console.log(`[ACCOUNTS] No matching account found for email: ${email}`);
			return undefined;
		}
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
				// eslint-disable-next-line security/detect-non-literal-regexp
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

	private resolveDataPath(...segments: string[]) {
		return path.resolve(process.cwd(), "data", ...segments);
	}
}
