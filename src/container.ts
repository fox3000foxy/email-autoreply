import "reflect-metadata";

import { Container } from "inversify";
import { App } from "./app";
import { AccountsService } from "./services/AccountsService";
import { ReplyService } from "./services/AIService/ReplyService";
import { SummaryService } from "./services/AIService/SummaryService";
import { ConfigService } from "./services/ConfigService";
import { ImapService } from "./services/MailService/ImapService";
import { ParserService } from "./services/MailService/ParserService";
import { SmtpService } from "./services/MailService/SmtpService";

const container = new Container({ defaultScope: "Singleton" });

container.bind<ConfigService>("ConfigService").to(ConfigService)
container.bind<AccountsService>("AccountsService").to(AccountsService)
container.bind<ParserService>("ParserService").to(ParserService)
container.bind<ImapService>("ImapService").to(ImapService);
container.bind<SmtpService>("SmtpService").to(SmtpService);
container.bind<SummaryService>("SummaryService").to(SummaryService);
container.bind<ReplyService>("ReplyService").to(ReplyService);
container.bind<App>("App").to(App);

export { container };

