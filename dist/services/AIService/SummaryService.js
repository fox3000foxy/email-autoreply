"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummaryService = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const groq_sdk_1 = require("groq-sdk");
const inversify_1 = require("inversify");
const node_path_1 = __importDefault(require("node:path"));
const BASE = node_path_1.default.join(process.cwd(), "data", "customers");
let SummaryService = class SummaryService {
    sanitizeSegment(s) {
        return encodeURIComponent(s).replace(/%2F/g, "_");
    }
    async ensureDir(dir) {
        try {
            await promises_1.default.mkdir(dir, { recursive: true });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        }
        catch (_err) {
            // ignore
        }
    }
    async readConversationFile(originalDest, fromEmail) {
        // Ensure the base directory exists so reads/writes won't fail when the folder is missing
        await this.ensureDir(BASE);
        const dir = node_path_1.default.join(BASE, this.sanitizeSegment(originalDest));
        const file = node_path_1.default.join(dir, `${this.sanitizeSegment(fromEmail)}.json`);
        try {
            const raw = await promises_1.default.readFile(file, "utf8");
            return JSON.parse(raw);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        }
        catch (_err) {
            return { interactions: [], summary: "" };
        }
    }
    async writeConversationFile(originalDest, fromEmail, data) {
        const dir = node_path_1.default.join(BASE, this.sanitizeSegment(originalDest));
        await this.ensureDir(dir);
        const file = node_path_1.default.join(dir, `${this.sanitizeSegment(fromEmail)}.json`);
        await promises_1.default.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    }
    getSystemPrompt() {
        return `You are a conversation memory assistant. You receive an existing concise summary (may be empty) and a new incoming message snippet. Produce an updated concise summary that preserves all factual information from the previous summary and the new snippet. Do not remove or contradict facts; if unsure, keep both facts. Keep the summary under 800 tokens.`;
    }
    getAgent() {
        return new groq_sdk_1.Groq({
            apiKey: process.env.GROQ_API_KEY || "",
        });
    }
    async completePrompt(options) {
        const groq = this.getAgent();
        return await groq.chat.completions.create(options);
    }
    async getConversationSummary(originalDest, fromEmail) {
        const data = await this.readConversationFile(originalDest, fromEmail);
        return data.summary || "";
    }
    async updateConversationSummary(originalDest, fromEmail, incomingContent) {
        const conv = await this.readConversationFile(originalDest, fromEmail);
        const now = new Date().toISOString();
        conv.interactions = conv.interactions || [];
        conv.interactions.push({
            at: now,
            snippet: incomingContent.slice(0, 2000),
        });
        // Build prompt to merge existing summary and new content into an updated summary
        const system = this.getSystemPrompt();
        const existing = conv.summary || "(empty)";
        const completion = await this.completePrompt({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: system },
                {
                    role: "user",
                    content: `Existing summary:\n${existing}\n\nNew incoming snippet:\n${incomingContent}`,
                },
            ],
            temperature: 0.0,
            max_tokens: 800,
        });
        const updated = completion.choices?.[0]?.message?.content?.trim() || existing;
        conv.summary = updated;
        await this.writeConversationFile(originalDest, fromEmail, conv);
        return updated;
    }
};
exports.SummaryService = SummaryService;
exports.SummaryService = SummaryService = __decorate([
    (0, inversify_1.injectable)()
], SummaryService);
