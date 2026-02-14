import type { ImapFlow, ListResponse } from 'imapflow';

export async function findAllMailMailbox(client: ImapFlow): Promise<string> {
  // Try to list all mailboxes from the server
  let listResult: ListResponse[];
  try {
    // ImapFlow.list signature can vary between versions; call without args to be safe
    listResult = await client.list();
    console.log(`[MAILBOX] Retrieved ${Array.isArray(listResult) ? listResult.length : 0} mailboxes from server.`);
  } catch (err) {  // eslint-disable-line @typescript-eslint/no-unused-vars
    return '[Gmail]/All Mail';
  }

  // Fallback: try common localized names
  const nameRegex = /\b(all mail|tous les messages|alle nachrichten|todos los mensajes|todos os emails|すべてのメール|全てのメール|вся почта)\b/i;
  for (const m of listResult) {
    const candidate = (m.path || m.name || '').toString();
    if (nameRegex.test(candidate)) return candidate;
  }

  // As a last resort, try to find the mailbox under the [Gmail] namespace
  for (const m of listResult) {
    const candidate = (m.path || m.name || '').toString();
    if (/^\[gmail\]\//i.test(candidate)) {
      if (nameRegex.test(candidate)) return candidate;
    }
  }

  // Give up and return a reasonable default used by many setups
  return '[Gmail]/All Mail';
}
