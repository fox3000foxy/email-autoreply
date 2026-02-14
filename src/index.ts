import { App } from "./app";
import { container } from "./container";

const app: App = container.get("App");
app.init().catch((err) => console.error(err));

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