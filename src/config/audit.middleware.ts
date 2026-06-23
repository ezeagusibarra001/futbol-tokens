import { Response, NextFunction } from 'express';
import { AuthRequest } from '../modules/auth/auth.middleware';
import { buildAuditEntry, writeAuditLog } from './audit.logger';

export const auditMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const entry = buildAuditEntry(
      {
        method: req.method,
        path: req.path,
        userId: req.userId,
        query: req.query as Record<string, unknown>,
        body: req.body as Record<string, unknown>,
        params: req.params as Record<string, unknown>,
      },
      res,
      start,
    );

    writeAuditLog(entry);
  });

  next();
};
