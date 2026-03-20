import fs from "fs";
import Groq from "groq-sdk";
import { inject, injectable } from "inversify";
import path from "path";
import { AccountsService } from "../AccountsService";
import { SummaryService } from "./SummaryService";

export const MANUAL_REPLY_TRIGGER = "<manual_reply_required>";
export const NO_REPLY_TRIGGER = "<no_reply>";

@injectable()
export class ReplyService {
  private groqClient: Groq | null = null;
  private static readonly MAX_TOTAL_INPUT_CHARS = 14000;
  private static readonly MAX_SYSTEM_PROMPT_CHARS = 3000;
  private static readonly MAX_SUMMARY_CHARS = 4000;
  private static readonly MAX_PERSONA_CHARS = 1500;
  private static readonly MAX_USER_CONTENT_CHARS = 8000;
  private static readonly RETRY_SYSTEM_CHARS = 2200;
  private static readonly RETRY_SUMMARY_CHARS = 1800;
  private static readonly RETRY_PERSONA_CHARS = 900;
  private static readonly RETRY_USER_CONTENT_CHARS = 2200;

  constructor(
    @inject("SummaryService") private summaryService: SummaryService,
    @inject("AccountsService") private accountsService: AccountsService,
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
    const systemPrompt = fs
      .readFileSync(this.resolveDataPath("base_prompt.txt"), "utf-8")
      .trim();
    return systemPrompt;
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

  private truncate(input: string, maxChars: number): string {
    if (!input || input.length <= maxChars) return input;
    const suffix = "\n[...truncated]";
    const sliceLength = Math.max(0, maxChars - suffix.length);
    return `${input.slice(0, sliceLength)}${suffix}`;
  }

  private isLengthError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const lowerMessage = error.message.toLowerCase();
    return (
      lowerMessage.includes("reduce the length") ||
      lowerMessage.includes("messages")
    );
  }

  private buildPromptPayload(options: {
    systemPrompt: string;
    conversationSummary: string;
    language: string;
    personaPrompt: string;
    content: string;
    limits: {
      systemPromptChars: number;
      summaryChars: number;
      personaChars: number;
      userContentChars: number;
    };
  }): { systemContent: string; userContent: string } {
    const boundedSystemPrompt = this.truncate(
      options.systemPrompt,
      options.limits.systemPromptChars,
    );
    const boundedSummary = this.truncate(
      options.conversationSummary,
      options.limits.summaryChars,
    );
    const boundedPersona = this.truncate(
      options.personaPrompt,
      options.limits.personaChars,
    );
    let userContent = this.truncate(
      options.content || "(message vide)",
      options.limits.userContentChars,
    );

    let systemContent = [
      boundedSystemPrompt,
      `Language: ${options.language}`,
      `Persona prompt: ${boundedPersona || "(none)"}`,
      boundedSummary ? `Conversation summary:\n${boundedSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const remainingForUser = Math.max(
      500,
      ReplyService.MAX_TOTAL_INPUT_CHARS - systemContent.length,
    );
    if (userContent.length > remainingForUser) {
      userContent = this.truncate(userContent, remainingForUser);
    }

    const currentTotal = systemContent.length + userContent.length;
    if (currentTotal > ReplyService.MAX_TOTAL_INPUT_CHARS) {
      const remainingForSystem = Math.max(
        1200,
        ReplyService.MAX_TOTAL_INPUT_CHARS - userContent.length,
      );
      systemContent = this.truncate(systemContent, remainingForSystem);
    }

    return { systemContent, userContent };
  }

  public async generateReply(options: {
    content: string;
    originalDest: string;
    personaPrompt: string;
    fromEmail: string;
  }): Promise<{ aiReply: string; manualTrigger: boolean; noReply: boolean }> {
    const conversationSummary =
      await this.summaryService.getConversationSummary(
        options.originalDest,
        options.fromEmail,
      );
    const language = await this.detectLanguage(options.content, "");
    const systemPrompt = await this.getSystemPrompt();
    let { systemContent, userContent } = this.buildPromptPayload({
      systemPrompt,
      conversationSummary,
      language,
      personaPrompt: options.personaPrompt,
      content: options.content,
      limits: {
        systemPromptChars: ReplyService.MAX_SYSTEM_PROMPT_CHARS,
        summaryChars: ReplyService.MAX_SUMMARY_CHARS,
        personaChars: ReplyService.MAX_PERSONA_CHARS,
        userContentChars: ReplyService.MAX_USER_CONTENT_CHARS,
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
    } catch (error) {
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
          systemPromptChars: ReplyService.RETRY_SYSTEM_CHARS,
          summaryChars: ReplyService.RETRY_SUMMARY_CHARS,
          personaChars: ReplyService.RETRY_PERSONA_CHARS,
          userContentChars: ReplyService.RETRY_USER_CONTENT_CHARS,
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

    const aiReply =
      completion.choices?.[0]?.message?.content?.trim() || "salut";
    const manualTrigger = aiReply.includes(MANUAL_REPLY_TRIGGER);
    const noReply = aiReply.includes(NO_REPLY_TRIGGER);
    return { aiReply, manualTrigger, noReply };
  }
}
