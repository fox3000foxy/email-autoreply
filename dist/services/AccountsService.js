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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountsService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const inversify_1 = require("inversify");
const node_path_1 = __importDefault(require("node:path"));
let AccountsService = class AccountsService {
    accounts;
    constructor() {
        this.accounts = this.loadAccounts();
    }
    findAccountByEmail(email) {
        if (!email)
            return undefined;
        console.log(`[ACCOUNTS] Looking for account matching email: ${email}`);
        const normalized = email.toLowerCase();
        const normalizedWithoutAlias = `${normalized.split("@")[0].split("+")[0]}@${normalized.split("@")[1]}`;
        console.log(`[ACCOUNTS] Normalized email for matching: ${normalizedWithoutAlias}`);
        const isExisting = this.accounts.find((entry) => entry.email instanceof RegExp
            ? entry.email.test(normalizedWithoutAlias)
            : entry.email.toLowerCase() === normalizedWithoutAlias);
        if (isExisting) {
            console.log(`[ACCOUNTS] Found matching account: ${isExisting.name} <${isExisting.email}>`);
            return {
                ...isExisting,
                originalEmail: email,
            };
        }
        else {
            console.log(`[ACCOUNTS] No matching account found for email: ${email}`);
            return undefined;
        }
    }
    loadAccounts() {
        const accountsPath = this.resolveDataPath("accounts.json");
        const raw = node_fs_1.default.readFileSync(accountsPath, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed.map((entry) => {
            const rawEmail = entry.email;
            let email;
            if (rawEmail instanceof RegExp) {
                email = rawEmail;
            }
            else if (typeof rawEmail === "string" &&
                rawEmail.startsWith("regex:")) {
                // eslint-disable-next-line security/detect-non-literal-regexp
                email = new RegExp(rawEmail.replace(/^regex:/, ""));
            }
            else if (typeof rawEmail === "string") {
                email = rawEmail;
            }
            else {
                email = String(rawEmail ?? "");
            }
            return {
                ...entry,
                email,
            };
        });
    }
    resolveDataPath(...segments) {
        return node_path_1.default.resolve(process.cwd(), "data", ...segments);
    }
};
exports.AccountsService = AccountsService;
exports.AccountsService = AccountsService = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], AccountsService);
