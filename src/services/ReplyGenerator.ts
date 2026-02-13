import type Groq from 'groq-sdk';

export const MANUAL_REPLY_TRIGGER = '<manual_reply_required>';

export async function generateReply(
  groq: Groq,
  systemPrompt: string,
  content: string,
  language: string
): Promise<{ aiReply: string; manualTrigger: boolean }> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: `${systemPrompt}\nLanguage: ${language}` },
      { role: 'user', content: content || '(message vide)' }
    ],
    temperature: 0.7,
    max_tokens: 200
  });

  const aiReply = completion.choices?.[0]?.message?.content?.trim() || 'salut';
  const manualTrigger = aiReply.includes(MANUAL_REPLY_TRIGGER);
  return { aiReply, manualTrigger };
}
