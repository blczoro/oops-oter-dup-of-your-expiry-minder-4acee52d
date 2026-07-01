let lastError: unknown = undefined;

const original = console.error;
console.error = (...args: unknown[]) => {
  const err = args.find((a) => a instanceof Error);
  if (err) lastError = err;
  original(...args);
};

export function consumeLastCapturedError(): unknown {
  const e = lastError;
  lastError = undefined;
  return e;
}
