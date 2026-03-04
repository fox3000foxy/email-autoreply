import { App } from "./app";
import { container } from "./container";

const actionMode = process.argv.includes("--action");
const writeGenericActionFailure = () => {
  process.stderr.write("Action failed\n");
};

if (actionMode) {
  const noop = () => undefined;
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
}

const app: App = container.get("App");

app.init({ actionMode }).catch((err) => {
  if (actionMode) {
    writeGenericActionFailure();
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});

process.on("uncaughtException", (error) => {
  if (actionMode) {
    writeGenericActionFailure();
  } else {
    console.log("Oh my god, something terrible happened: ", error);
  }
  process.exitCode = 1;
});

process.on("unhandledRejection", (error, promise) => {
  if (actionMode) {
    writeGenericActionFailure();
  } else {
    console.log(
      " Oh Lord! We forgot to handle a promise rejection here: ",
      promise,
    );
    console.log(" The error was: ", error);
  }
  process.exitCode = 1;
});