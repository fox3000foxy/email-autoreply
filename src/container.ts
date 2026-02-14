import "reflect-metadata";

import { ImapFlow } from "imapflow";
import { Container } from "inversify";
import { ConfigService } from "./services/ConfigService";
import { TYPES } from "./types";

const container = new Container({ defaultScope: "Singleton" });

container.bind<ImapFlow>(TYPES.ImapFlow).toDynamicValue((ctx) => {
  const config = ctx.container.get<ConfigService>(TYPES.ConfigService);
  console.log(
    `[IMAP] Creating IMAP client with config: ${JSON.stringify({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.imapTls,
      user: config.user,
      // pass is intentionally not logged for security reasons
    })}`,
  );
  return new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapTls,
    logger: false,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
});

export { container };

