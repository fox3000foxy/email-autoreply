import { simpleParser } from 'mailparser';

export type ParsedMailLike = {
  text?: string;
  html?: string;
  headers?: Map<string, string>;
  to?: unknown;
};

export async function parseEmail(source: Buffer | string): Promise<ParsedMailLike> {
  const parsed = await simpleParser(source as any) as ParsedMailLike;
  return parsed;
}

export function extractEmails(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(v => extractEmails(v));
  if (typeof value === 'string') {
    return (value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
      .map(v => v.toLowerCase());
  }
  if (typeof value === 'object') {
    const typedValue = value as { value?: Array<{ address?: string }>; address?: string; text?: string };
    if (Array.isArray(typedValue.value)) {
      return typedValue.value
        .map(v => v.address)
        .filter((v): v is string => Boolean(v))
        .map(v => v.toLowerCase());
    }
    if (typedValue.address) return [typedValue.address.toLowerCase()];
    if (typedValue.text) return extractEmails(typedValue.text);
  }
  return [];
}
