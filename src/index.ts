import type { App } from "./app";
import { container } from "./container";

const isActionMode = process.argv.includes("--action");

const writeGenericActionFailure = (): void => {
  process.stderr.write("Action failed\n");
};

const muteConsole = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const noop = (..._args: unknown[]): void => undefined;
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
};

const reportError = (label: string, error: unknown): void => {
  if (error instanceof Error) {
    console.error(`${label}: ${error.message}`);
    if (error.stack) console.error(error.stack);
    return;
  }
  console.error(`${label}:`, error);
};

const handleFatalError = (error: unknown): void => {
  if (isActionMode) {
    writeGenericActionFailure();
  } else {
    reportError("Fatal error", error);
  }
  process.exitCode = 1;
};

if (isActionMode) {
  muteConsole();
}

const main = async (): Promise<void> => {
  const app = container.get<App>("App");
  await app.init({ actionMode: isActionMode });
};

void main().catch(handleFatalError);

process.on("uncaughtException", (error) => {
  handleFatalError(error);
});

process.on("unhandledRejection", (reason, promise) => {
  if (!isActionMode) {
    console.error("Unhandled promise rejection at:", promise);
  }
  handleFatalError(reason);
});
