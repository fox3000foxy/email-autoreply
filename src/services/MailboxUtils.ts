import type { ImapFlow } from 'imapflow';

export async function findAllMailMailbox(client: ImapFlow): Promise<string> {
  // Try to list all mailboxes from the server
  let listResult: any;
  try {
    // ImapFlow.list signature can vary between versions; call without args to be safe
    listResult = await client.list();
    console.log(`[MAILBOX] Retrieved ${Array.isArray(listResult) ? listResult.length : 0} mailboxes from server.`);
  } catch (err) {
    return '[Gmail]/All Mail';
  }

  const mailboxes: any[] = [];
  if (listResult && typeof (listResult as any)[Symbol.asyncIterator] === 'function') {
    for await (const m of listResult as any) mailboxes.push(m);
  } else if (Array.isArray(listResult)) {
    mailboxes.push(...listResult);
  } else if (listResult) {
    mailboxes.push(listResult);
  }

  // Prefer a mailbox that advertises the special-use \All flag
  for (const m of mailboxes) {
    const attrs = m.attributes || m.flags || m.specialUse || m.specialuse || [];
    if (Array.isArray(attrs) && attrs.map(String).some((a: string) => a.toLowerCase() === '\\all')) {
      return (m.path || m.name || m.mailbox || '').toString();
    }
    if (typeof attrs === 'string' && attrs.toLowerCase().includes('\\all')) {
      return (m.path || m.name || m.mailbox || '').toString();
    }
  }

  // Fallback: try common localized names
  const nameRegex = /\b(all mail|tous les messages|alle nachrichten|todos los mensajes|todos os emails|すべてのメール|全てのメール|вся почта)\b/i;
  for (const m of mailboxes) {
    const candidate = (m.path || m.name || m.mailbox || '').toString();
    if (nameRegex.test(candidate)) return candidate;
  }

  // As a last resort, try to find the mailbox under the [Gmail] namespace
  for (const m of mailboxes) {
    const candidate = (m.path || m.name || m.mailbox || '').toString();
    if (/^\[gmail\]\//i.test(candidate)) {
      if (nameRegex.test(candidate)) return candidate;
    }
  }

  // Give up and return a reasonable default used by many setups
  return '[Gmail]/All Mail';
}
