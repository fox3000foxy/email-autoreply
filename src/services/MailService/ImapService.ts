import { ImapFlow, ListResponse } from "imapflow";
import { inject, injectable } from "inversify";
import { ConfigService } from "../ConfigService";

const MAX_RECONNECT_DELAY_MS = 60_000;
const INITIAL_RECONNECT_DELAY_MS = 5_000;
const NOOP_INTERVAL_MS = 30_000; // 30 s — generous enough to avoid spam

@injectable()
export class ImapService {
  private client: ImapFlow | null = null;
   
  private persistentListeners: Array<{
    event: string;
    handler: (...args: unknown[]) => void;
  }> = [];

  constructor(@inject("ConfigService") private configService: ConfigService) {
    this.client = null;
  }

  /**
   * Register an event listener that will be re-attached on every reconnect.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (...args: any[]) => void): void {
    this.persistentListeners.push({ event, handler });
    // Attach immediately if a client already exists
    if (this.client) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.client as any).on(event, handler);
    }
  }

  /**
   * Create a **fresh** ImapFlow instance (discards previous one).
   */
  private createFlow(): ImapFlow {
    this.client = new ImapFlow({
      host: this.configService.imapHost,
      port: this.configService.imapPort,
      secure: this.configService.imapTls,
      logger: false,
      auth: {
        user: this.configService.user,
        pass: this.configService.pass,
      },
    });
    // Re-attach all persistent listeners to the new client
    for (const { event, handler } of this.persistentListeners) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.client as any).on(event, handler);
    }
    return this.client;
  }

  async getFlow(): Promise<ImapFlow> {
    if (!this.client) {
      this.createFlow();
    }
    return this.client!;
  }

  /**
   * Persistent connection loop.
   * If the connection drops for any reason the method tears everything down,
   * waits with exponential back-off, creates a brand-new ImapFlow and retries.
   */
  async connect(): Promise<void> {
    let delay = INITIAL_RECONNECT_DELAY_MS;

    while (true) {
      let client: ImapFlow | null = null;
      let lock: { release: () => void } | null = null;
      let noopInterval: ReturnType<typeof setInterval> | null = null;

      try {
        console.log("[IMAP] Connecting to IMAP server...");
        client = this.createFlow();
        await client.connect();
        console.log("[IMAP] Connected.");

        const mailboxName = await this.findAllMailMailbox();
        console.log(`[IMAP] Using mailbox: ${mailboxName}`);

        lock = await client.getMailboxLock(mailboxName);
        console.log("[IMAP] Entering IDLE loop (mailbox lock acquired).");

        // Reset back-off after a successful connection
        delay = INITIAL_RECONNECT_DELAY_MS;

        // Keep-alive NOOP — only when the client is still usable
        noopInterval = setInterval(() => {
          if (!client?.usable) return;
          client.noop().catch(() => {
            /* will be caught by IDLE error */
          });
        }, NOOP_INTERVAL_MS);

        // IDLE loop — runs until the connection dies
        while (client.usable) {
          await client.idle();
        }

        // If we exit the loop the connection is no longer usable
        console.warn("[IMAP] Connection no longer usable, will reconnect.");
      } catch (err) {
        console.error(
          `[IMAP] Connection error, reconnecting in ${delay / 1000}s`,
          err,
        );
      } finally {
        // Cleanup
        if (noopInterval) clearInterval(noopInterval);
        if (lock) {
          try {
            lock.release();
          } catch {
            /* already released */
          }
        }
        try {
          await this.destroyClient();
        } catch {
          /* best-effort */
        }
      }

      await new Promise((res) => setTimeout(res, delay));
      delay = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
    }
  }

  /**
   * Tear down the current client so a fresh one can be created.
   */
  private async destroyClient(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        /* ignore */
      }
      this.client = null;
    }
  }

  async disconnect(): Promise<void> {
    await this.destroyClient();
  }

  async findAllMailMailbox(): Promise<string> {
    // Try to list all mailboxes from the server
    let listResult: ListResponse[];
    const client = await this.getFlow();
    try {
      // ImapFlow.list signature can vary between versions; call without args to be safe
      listResult = await client.list();
      console.log(
        `[MAILBOX] Retrieved ${Array.isArray(listResult) ? listResult.length : 0} mailboxes from server.`,
      );
    } catch (err) {
      console.error("[MAILBOX] Error retrieving mailboxes:", err);
      return "[Gmail]/All Mail";
    }

    // Fallback: try common localized names
    const nameRegex =
      /\b(all mail|tous les messages|alle nachrichten|todos los mensajes|todos os emails|すべてのメール|全てのメール|вся почта)\b/i;
    for (const m of listResult) {
      const candidate = (m.path || m.name || "").toString();
      if (nameRegex.test(candidate)) return candidate;
    }

    // As a last resort, try to find the mailbox under the [Gmail] namespace
    for (const m of listResult) {
      const candidate = (m.path || m.name || "").toString();
      if (/^\[gmail\]\//i.test(candidate)) {
        if (nameRegex.test(candidate)) return candidate;
      }
    }

    // Give up and return a reasonable default used by many setups
    return "[Gmail]/All Mail";
  }
}
