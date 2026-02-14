import { container } from "./di/container";
import { TYPES } from "./di/types";
import { EmailAutoReplyApp } from "./services/EmailAutoReplyApp";

const app = container.get<EmailAutoReplyApp>(TYPES.EmailAutoReplyApp);
app.run().catch((err) => console.error(err));

process.on("uncaughtException", (error) => {
  console.log("Oh my god, something terrible happened: ", error);
});

process.on("unhandledRejection", (error, promise) => {
  console.log(
    " Oh Lord! We forgot to handle a promise rejection here: ",
    promise,
  );
  console.log(" The error was: ", error);
});
