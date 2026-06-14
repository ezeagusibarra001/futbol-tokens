import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const LOG_DIR = process.env.AUDIT_LOG_DIR ?? path.resolve(process.cwd(), 'logs');
const MAX_FILE_SIZE = 10 * 1024 * 1024;

let currentDate: string | null = null;
let writeStream: fs.WriteStream | null = null;

type AuditEntry = {
  timestamp: string;
  user: string;
  operation: string;
  parameters: Record<string, unknown>;
  executionTime: number;
  status: number;
};

const sanitize = (obj: Record<string, unknown>): Record<string, unknown> => {
  const sensitive = ['password', 'token', 'secret', 'authorization', 'refreshToken'];
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.includes(key)) {
      sanitized[key] = '***';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitize(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const ensureDir = (): void => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

const rotateStream = (): void => {
  const today = new Date().toISOString().slice(0, 10);
  if (currentDate === today && writeStream) return;

  if (writeStream) {
    writeStream.end();
  }

  ensureDir();
  currentDate = today;
  const filePath = path.join(LOG_DIR, `audit-${today}.log`);

  const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  if (stats && stats.size >= MAX_FILE_SIZE) {
    const idx = 1;
    const rotated = path.join(LOG_DIR, `audit-${today}.${idx}.log`);
    fs.renameSync(filePath, rotated);
  }

  writeStream = fs.createWriteStream(filePath, { flags: 'a' });
};

export const writeAuditLog = (entry: AuditEntry): void => {
  const line = JSON.stringify(entry) + '\n';

  rotateStream();
  writeStream?.write(line);

  logger.info(`[AUDIT] ${entry.operation}`, {
    user: entry.user,
    status: entry.status,
    ms: entry.executionTime,
  });
};

export const buildAuditEntry = (
  req: { method: string; path: string; userId?: string; query: Record<string, unknown>; body: Record<string, unknown>; params: Record<string, unknown> },
  res: { statusCode: number },
  startTime: number,
): AuditEntry => ({
  timestamp: new Date().toISOString(),
  user: req.userId ?? 'anonymous',
  operation: `${req.method} ${req.path}`,
  parameters: sanitize({ ...req.query, ...req.params, ...req.body }),
  executionTime: Date.now() - startTime,
  status: res.statusCode,
});

export const closeAuditLog = (): void => {
  if (writeStream) {
    writeStream.end();
  }
};
