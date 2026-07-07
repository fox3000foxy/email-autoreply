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
exports.ConfigService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const inversify_1 = require("inversify");
const node_path_1 = __importDefault(require("node:path"));
let ConfigService = class ConfigService {
    constructor() {
        dotenv_1.default.config({ path: node_path_1.default.join(process.cwd(), ".env") });
    }
    requireEnv(key) {
        const allowedKeys = [
            "MAILUSER",
            "MAILPASS",
            "GROQ_API_KEY",
            "IMAP_HOST",
            "IMAP_PORT",
            "IMAP_TLS",
            "NODEMAILER_HOST",
            "NODEMAILER_PORT",
            "NODEMAILER_SECURE",
            "MANUAL_REPLYER",
        ];
        if (!allowedKeys.includes(key)) {
            throw new Error(`${key} is not a valid environment variable.`);
        }
        const value = process.env[key];
        if (!value) {
            throw new Error(`${key} manquant.`);
        }
        return value;
    }
    get user() {
        return this.requireEnv("MAILUSER");
    }
    get pass() {
        return this.requireEnv("MAILPASS");
    }
    get groqApiKey() {
        return this.requireEnv("GROQ_API_KEY");
    }
    get imapHost() {
        return this.requireEnv("IMAP_HOST");
    }
    get imapPort() {
        return this.requireEnv("IMAP_PORT")
            ? Number(this.requireEnv("IMAP_PORT"))
            : 993;
    }
    get imapTls() {
        return this.requireEnv("IMAP_TLS") === "true";
    }
    get smtpHost() {
        return this.requireEnv("NODEMAILER_HOST") || "smtp.gmail.com";
    }
    get smtpPort() {
        return this.requireEnv("NODEMAILER_PORT")
            ? Number(this.requireEnv("NODEMAILER_PORT"))
            : 587;
    }
    get smtpSecure() {
        return this.requireEnv("NODEMAILER_SECURE")
            ? this.requireEnv("NODEMAILER_SECURE") === "true"
            : false;
    }
    get manualReplyer() {
        return this.requireEnv("MANUAL_REPLYER");
    }
};
exports.ConfigService = ConfigService;
exports.ConfigService = ConfigService = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], ConfigService);
