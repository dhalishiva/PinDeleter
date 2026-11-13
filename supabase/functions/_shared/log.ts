// Structured JSON logging. Values under sensitive-looking keys are redacted, so secrets never reach the logs.

type Level = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE = /token|secret|password|authorization|code_verifier|apikey|api_key|^code$|cookie|signature/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[depth]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && /^(pina|pinr|pinc|Bearer )/.test(value)) return '[redacted]';
  return value;
}

function write(level: Level, msg: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    ...(redact(fields ?? {}) as object),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function errorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { error: err.message, errorName: err.name };
  return { error: String(err) };
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => write('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};
