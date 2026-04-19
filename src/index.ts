import type { App } from "./app";
import { container } from "./container";

const isActionMode = process.argv.includes("--action");

const writeGenericActionFailure = (): void => {
	process.stderr.write("Action failed\n");
};

const muteConsole = (): void => {
	// In action mode we want to suppress noisy logs, but keeping stderr/error
	// output is helpful for debugging failures.  Only silence log/info/debug.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const noop = (..._args: unknown[]): void => undefined;
	console.log = noop;
	console.info = noop;
	console.debug = noop;
	// leave console.warn and console.error intact so errors surface
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
	// always report the actual error, even in action mode, then emit the
	// generic line that the GitHub job uses as a failure indicator.  When
	// running on the cron workflow we mute normal console.log output, so the
	// only way to see what went wrong is via stderr.
	reportError("Fatal error", error);

	if (isActionMode) {
		writeGenericActionFailure();
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
