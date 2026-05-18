type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const envLevel = (): Level => {
  const v = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as Level;
  return LEVELS[v] ? v : 'info';
};

const ts = () => new Date().toISOString();

const out = (level: Level, msg: string, meta?: Record<string, unknown>) => {
  if (LEVELS[level] < LEVELS[envLevel()]) return;
  const payload = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const line = `[${ts()}] ${level.toUpperCase()} ${msg}${payload}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => out('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => out('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => out('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => out('error', msg, meta),
};
