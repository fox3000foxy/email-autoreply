import fs from 'fs/promises';
import type Groq from 'groq-sdk';
import path from 'path';

const BASE = path.join(process.cwd(), 'data', 'customers');

function sanitizeSegment(s: string): string {
  return encodeURIComponent(s).replace(/%2F/g, '_');
}

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (_err: unknown) {  // eslint-disable-line @typescript-eslint/no-unused-vars
    // ignore
  }
}

export async function readConversationFile(originalDest: string, fromEmail: string) {
  // Ensure the base directory exists so reads/writes won't fail when the folder is missing
  await ensureDir(BASE);
  const dir = path.join(BASE, sanitizeSegment(originalDest));
  const file = path.join(dir, sanitizeSegment(fromEmail) + '.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (_err: unknown) {   // eslint-disable-line @typescript-eslint/no-unused-vars
    return { interactions: [], summary: '' };
  }
}

export async function writeConversationFile(originalDest: string, fromEmail: string, data: object) {
  const dir = path.join(BASE, sanitizeSegment(originalDest));
  await ensureDir(dir);
  const file = path.join(dir, sanitizeSegment(fromEmail) + '.json');
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

export async function updateConversationSummary(
  groq: Groq,
  originalDest: string,
  fromEmail: string,
  incomingContent: string
): Promise<string> {
  const conv = await readConversationFile(originalDest, fromEmail);

  const now = new Date().toISOString();
  conv.interactions = conv.interactions || [];
  conv.interactions.push({ at: now, snippet: incomingContent.slice(0, 2000) });

  // Build prompt to merge existing summary and new content into an updated summary
  const system = `You are a conversation memory assistant. You receive an existing concise summary (may be empty) and a new incoming message snippet. Produce an updated concise summary that preserves all factual information from the previous summary and the new snippet. Do not remove or contradict facts; if unsure, keep both facts. Keep the summary under 800 tokens.`;

  const existing = conv.summary || '(empty)';

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Existing summary:\n${existing}\n\nNew incoming snippet:\n${incomingContent}` }
    ],
    temperature: 0.0,
    max_tokens: 800
  });

  const updated = completion.choices?.[0]?.message?.content?.trim() || existing;
  conv.summary = updated;

  await writeConversationFile(originalDest, fromEmail, conv);
  return updated;
}
