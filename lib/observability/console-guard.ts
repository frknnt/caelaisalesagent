import { createLogger, type Logger } from "./logger";
import { errorFields } from "./redaction";

type GuardedConsole = Pick<Console, "error" | "warn">;

/**
 * Next.js and libraries print caught errors with their full message, which can
 * quote visitor text. In production each such call becomes one structured line
 * with the error's type, code, digest and call sites; free text is dropped.
 * The logger itself writes through console.log, so it does not loop.
 */
export function installConsoleGuard(
  target: GuardedConsole = console,
  logger: Logger = createLogger(),
) {
  const { error: originalError, warn: originalWarn } = target;
  const errorIn = (args: unknown[]) =>
    args.find((arg) => arg instanceof Error) ?? args[0];

  target.error = (...args: unknown[]) =>
    logger.error("console.error", errorIn(args));
  target.warn = (...args: unknown[]) =>
    logger.warn("console.warn", errorFields(errorIn(args)));

  return () => {
    target.error = originalError;
    target.warn = originalWarn;
  };
}
