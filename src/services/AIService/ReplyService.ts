import fs from "fs";
import Groq from "groq-sdk";
import { inject, injectable } from "inversify";
import path from "path";
import { SummaryService } from "./SummaryService";

export const MANUAL_REPLY_TRIGGER = "<manual_reply_required>";

@injectable()
export class ReplyService {
    private groqClient: Groq | null = null;
    private systemPrompt: string | null = null;

    constructor(
        @inject("SummaryService") private summaryService: SummaryService,
    ) {}

    private getGroqClient(): Groq {
        if (!this.groqClient) {
            this.groqClient = new Groq({
                apiKey: process.env.GROQ_API_KEY || "",
            });
        }
        return this.groqClient;
    }

    private resolveDataPath(...segments: string[]) {
        return path.resolve(process.cwd(), "data", ...segments);
    }

    private async getSystemPrompt(): Promise<string> {
        return fs
            .readFileSync(this.resolveDataPath("base_prompt.txt"), "utf-8")
            .trim();
    }

    private async detectLanguage(
        textContent: string,
        htmlContent: string,
    ): Promise<string> {
        const franc = (await import("franc")).franc;
        const detected = franc(`${textContent} ${htmlContent}`, { minLength: 20 });
        if (detected === "fra") return "fr";
        if (detected === "eng") return "en";
        return "fr";
    }


    public async generateReply(
        options: { content: string; originalDest: string; fromEmail: string },
    ): Promise<{ aiReply: string; manualTrigger: boolean }> {
        const conversationSummary = await this.summaryService.getConversationSummary(options.originalDest, options.fromEmail);
        const language = await this.detectLanguage(options.content, "");
        const systemPrompt = await this.getSystemPrompt();
        const systemContent = conversationSummary
            ? `${systemPrompt}\nConversation summary:\n${conversationSummary}\nLanguage: ${language}`
            : `${systemPrompt}\nLanguage: ${language}`;

        const completion = await this.getGroqClient().chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemContent },
                { role: "user", content: options.content || "(message vide)" },
            ],
            temperature: 0.7,
            max_tokens: 200,
        });

        const aiReply = completion.choices?.[0]?.message?.content?.trim() || "salut";
        const manualTrigger = aiReply.includes(MANUAL_REPLY_TRIGGER);
        return { aiReply, manualTrigger };
    }

}

