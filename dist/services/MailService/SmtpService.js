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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmtpService = void 0;
const inversify_1 = require("inversify");
const nodemailer_1 = __importDefault(require("nodemailer"));
let SmtpService = class SmtpService {
    configService;
    transporter = null;
    constructor(configService) {
        this.configService = configService;
        this.configService = configService;
    }
    async connect() {
        if (!this.transporter) {
            this.transporter = nodemailer_1.default.createTransport({
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
    async disconnect() {
        // Nodemailer doesn't have a built-in disconnect method, but if using a connection pool, you can close it
        if (this.transporter) {
            this.transporter.close();
            this.transporter = null;
        }
    }
    async sendMail(options) {
        if (!this.transporter) {
            throw new Error("SMTP transporter is not initialized. Call connect() first.");
        }
        await this.transporter.sendMail(options);
    }
    get manualReplyer() {
        return this.configService.manualReplyer || this.configService.user;
    }
    async sendManualForward(from, envelopeTo, subject, emailContent) {
        if (!this.transporter) {
            throw new Error("SMTP transporter is not initialized. Call connect() first.");
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
    async sendReply(from, to, subject, aiReply, inReplyTo) {
        if (!this.transporter) {
            throw new Error("SMTP transporter is not initialized. Call connect() first.");
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
};
exports.SmtpService = SmtpService;
exports.SmtpService = SmtpService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("ConfigService")),
    __metadata("design:paramtypes", [Function])
], SmtpService);
