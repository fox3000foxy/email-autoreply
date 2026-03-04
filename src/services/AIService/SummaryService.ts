import fs from "fs/promises";
import { Groq } from "groq-sdk";
import { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions.mjs";
import { injectable } from "inversify";
import path from "path";

const BASE = path.join(process.cwd(), "data", "customers");

interface ConversationData {
  interactions: Array<{ at: string; snippet: string }>;
  summary: string;
}

@injectable()
export class SummaryService {
  private sanitizeSegment(s: string): string {
    return encodeURIComponent(s).replace(/%2F/g, "_");
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err: unknown) {
      // ignore
    }
  }

  private async readConversationFile(
    originalDest: string,
    fromEmail: string,
  ): Promise<ConversationData> {
    // Ensure the base directory exists so reads/writes won't fail when the folder is missing
    await this.ensureDir(BASE);
    const dir = path.join(BASE, this.sanitizeSegment(originalDest));
    const file = path.join(dir, this.sanitizeSegment(fromEmail) + ".json");
    try {
      const raw = await fs.readFile(file, "utf8");
      return JSON.parse(raw);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err: unknown) {
      return { interactions: [], summary: "" };
    }
  }

  private async writeConversationFile(
    originalDest: string,
    fromEmail: string,
    data: ConversationData,
  ): Promise<void> {
    const dir = path.join(BASE, this.sanitizeSegment(originalDest));
    await this.ensureDir(dir);
    const file = path.join(dir, this.sanitizeSegment(fromEmail) + ".json");
    await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
  }

  private getSystemPrompt(): string {
    return `You are a conversation memory assistant. You receive an existing concise summary (may be empty) and a new incoming message snippet. Produce an updated concise summary that preserves all factual information from the previous summary and the new snippet. Do not remove or contradict facts; if unsure, keep both facts. Keep the summary under 800 tokens.`;
  }

  private getAgent(): Groq {
    return new Groq({
      apiKey: process.env.GROQ_API_KEY || "",
    });
  }

  private async completePrompt(
    options: ChatCompletionCreateParamsNonStreaming,
  ): Promise<Groq.Chat.Completions.ChatCompletion> {
    const groq = this.getAgent();
    return await groq.chat.completions.create(options);
  }

  public async getConversationSummary(
    originalDest: string,
    fromEmail: string,
  ): Promise<string> {
    const data = await this.readConversationFile(originalDest, fromEmail);
    return data.summary || "";
  }

  public async updateConversationSummary(
    originalDest: string,
    fromEmail: string,
    incomingContent: string,
  ): Promise<string> {
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

    const updated =
      completion.choices?.[0]?.message?.content?.trim() || existing;
    conv.summary = updated;

    await this.writeConversationFile(originalDest, fromEmail, conv);
    return updated;
  }
}
