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
var ReplyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplyService = exports.NO_REPLY_TRIGGER = exports.MANUAL_REPLY_TRIGGER = void 0;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const inversify_1 = require("inversify");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
exports.MANUAL_REPLY_TRIGGER = "<manual_reply_required>";
exports.NO_REPLY_TRIGGER = "<no_reply>";
let ReplyService = class ReplyService {
    static { ReplyService_1 = this; }
    summaryService;
    accountsService;
    groqClient = null;
    static MAX_TOTAL_INPUT_CHARS = 14000;
    static MAX_SYSTEM_PROMPT_CHARS = 3000;
    static MAX_SUMMARY_CHARS = 4000;
    static MAX_PERSONA_CHARS = 1500;
    static MAX_USER_CONTENT_CHARS = 8000;
    static RETRY_SYSTEM_CHARS = 2200;
    static RETRY_SUMMARY_CHARS = 1800;
    static RETRY_PERSONA_CHARS = 900;
    static RETRY_USER_CONTENT_CHARS = 2200;
    constructor(summaryService, accountsService) {
        this.summaryService = summaryService;
        this.accountsService = accountsService;
        this.summaryService = summaryService;
        this.accountsService = accountsService;
    }
    getGroqClient() {
        if (!this.groqClient) {
            this.groqClient = new groq_sdk_1.default({
                apiKey: process.env.GROQ_API_KEY || "",
            });
        }
        return this.groqClient;
    }
    resolveDataPath(...segments) {
        return node_path_1.default.resolve(process.cwd(), "data", ...segments);
    }
    async getSystemPrompt() {
        const systemPrompt = node_fs_1.default
            .readFileSync(this.resolveDataPath("base_prompt.txt"), "utf-8")
            .trim();
        return systemPrompt;
    }
    async detectLanguage(textContent, htmlContent) {
        const franc = (await import("franc")).franc;
        const detected = franc(`${textContent} ${htmlContent}`, { minLength: 20 });
        if (detected === "fra")
            return "fr";
        if (detected === "eng")
            return "en";
        return "fr";
    }
    truncate(input, maxChars) {
        if (!input || input.length <= maxChars)
            return input;
        const suffix = "\n[...truncated]";
        const sliceLength = Math.max(0, maxChars - suffix.length);
        return `${input.slice(0, sliceLength)}${suffix}`;
    }
    isLengthError(error) {
        if (!(error instanceof Error))
            return false;
        const lowerMessage = error.message.toLowerCase();
        return (lowerMessage.includes("reduce the length") ||
            lowerMessage.includes("messages"));
    }
    buildPromptPayload(options) {
        const boundedSystemPrompt = this.truncate(options.systemPrompt, options.limits.systemPromptChars);
        const boundedSummary = this.truncate(options.conversationSummary, options.limits.summaryChars);
        const boundedPersona = this.truncate(options.personaPrompt, options.limits.personaChars);
        let userContent = this.truncate(options.content || "(message vide)", options.limits.userContentChars);
        let systemContent = [
            boundedSystemPrompt,
            `Language: ${options.language}`,
            `Persona prompt: ${boundedPersona || "(none)"}`,
            boundedSummary ? `Conversation summary:\n${boundedSummary}` : "",
        ]
            .filter(Boolean)
            .join("\n");
        const remainingForUser = Math.max(500, ReplyService_1.MAX_TOTAL_INPUT_CHARS - systemContent.length);
        if (userContent.length > remainingForUser) {
            userContent = this.truncate(userContent, remainingForUser);
        }
        const currentTotal = systemContent.length + userContent.length;
        if (currentTotal > ReplyService_1.MAX_TOTAL_INPUT_CHARS) {
            const remainingForSystem = Math.max(1200, ReplyService_1.MAX_TOTAL_INPUT_CHARS - userContent.length);
            systemContent = this.truncate(systemContent, remainingForSystem);
        }
        return { systemContent, userContent };
    }
    async generateReply(options) {
        const conversationSummary = await this.summaryService.getConversationSummary(options.originalDest, options.fromEmail);
        const language = await this.detectLanguage(options.content, "");
        const systemPrompt = await this.getSystemPrompt();
        let { systemContent, userContent } = this.buildPromptPayload({
            systemPrompt,
            conversationSummary,
            language,
            personaPrompt: options.personaPrompt,
            content: options.content,
            limits: {
                systemPromptChars: ReplyService_1.MAX_SYSTEM_PROMPT_CHARS,
                summaryChars: ReplyService_1.MAX_SUMMARY_CHARS,
                personaChars: ReplyService_1.MAX_PERSONA_CHARS,
                userContentChars: ReplyService_1.MAX_USER_CONTENT_CHARS,
            },
        });
        let completion;
        try {
            completion = await this.getGroqClient().chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemContent },
                    { role: "user", content: userContent },
                ],
                temperature: 0.7,
                max_tokens: 200,
            });
        }
        catch (error) {
            if (!this.isLengthError(error)) {
                throw error;
            }
            ({ systemContent, userContent } = this.buildPromptPayload({
                systemPrompt,
                conversationSummary,
                language,
                personaPrompt: options.personaPrompt,
                content: options.content,
                limits: {
                    systemPromptChars: ReplyService_1.RETRY_SYSTEM_CHARS,
                    summaryChars: ReplyService_1.RETRY_SUMMARY_CHARS,
                    personaChars: ReplyService_1.RETRY_PERSONA_CHARS,
                    userContentChars: ReplyService_1.RETRY_USER_CONTENT_CHARS,
                },
            }));
            completion = await this.getGroqClient().chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemContent },
                    { role: "user", content: userContent },
                ],
                temperature: 0.7,
                max_tokens: 200,
            });
        }
        const aiReply = completion.choices?.[0]?.message?.content?.trim() || "salut";
        const manualTrigger = aiReply.includes(exports.MANUAL_REPLY_TRIGGER);
        const noReply = aiReply.includes(exports.NO_REPLY_TRIGGER);
        return { aiReply, manualTrigger, noReply };
    }
};
exports.ReplyService = ReplyService;
exports.ReplyService = ReplyService = ReplyService_1 = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("SummaryService")),
    __param(1, (0, inversify_1.inject)("AccountsService")),
    __metadata("design:paramtypes", [Function, Function])
], ReplyService);
