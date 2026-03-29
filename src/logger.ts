type Level = "info" | "warn" | "error";

function log(level: Level, msg: string, extra?: Record<string, unknown>) {
  const entry = JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    ...extra,
  });

  if (level === "error") {
    process.stderr.write(`${entry}\n`);
  } else {
    process.stdout.write(`${entry}\n`);
  }
}

export const logger = {
  info: (msg: string, extra?: Record<string, unknown>) =>
    log("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) =>
    log("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) =>
    log("error", msg, extra),
};
