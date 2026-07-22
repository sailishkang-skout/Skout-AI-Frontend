import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

interface ClientLogFields {
  [key: string]: unknown;
}

function emit(level: LogLevel, module: string, message: string, fields?: ClientLogFields) {
  const payload = {
    level,
    module,
    message,
    ts: new Date().toISOString(),
    ...fields,
  };

  if (process.env.NODE_ENV === "production") {
    // Structured JSON for browser log forwarders (Datadog RUM / CloudWatch RUM later).
    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  const prefix = `[${module}]`;
  if (level === "error") console.error(prefix, message, fields ?? "");
  else if (level === "warn") console.warn(prefix, message, fields ?? "");
  else console.log(prefix, message, fields ?? "");
}

export interface ClientLogger {
  readonly module: string;
  debug(message: string, fields?: ClientLogFields): void;
  info(message: string, fields?: ClientLogFields): void;
  warn(message: string, fields?: ClientLogFields): void;
  error(message: string, error?: unknown, fields?: ClientLogFields): void;
}

/** Browser-safe logger — same module naming convention as @skout/observability. */
export function createClientLogger(module: string): ClientLogger {
  return {
    module,
    debug(message, fields) {
      emit("debug", module, message, fields);
    },
    info(message, fields) {
      emit("info", module, message, fields);
    },
    warn(message, fields) {
      emit("warn", module, message, fields);
    },
    error(message, error, fields) {
      emit("error", module, message, {
        ...fields,
        ...(error instanceof Error
          ? { err: { name: error.name, message: error.message } }
          : error !== undefined
            ? { err: { message: String(error) } }
            : {}),
      });
    },
  };
}

/** Log + send to Sentry (use for unexpected failures, not routine 4xx). */
export function logAndCapture(
  log: ClientLogger,
  err: unknown,
  message: string,
  fields?: ClientLogFields
): void {
  log.error(message, err, fields);
  const exception = err instanceof Error ? err : new Error(message);
  Sentry.captureException(exception, {
    tags: { module: log.module },
    extra: { message, ...fields },
  });
}
