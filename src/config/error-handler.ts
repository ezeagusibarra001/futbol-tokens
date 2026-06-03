import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export type HttpError = Error & { status?: number; expose?: boolean };

export const httpError = (message: string, status: number): HttpError =>
  Object.assign(new Error(message), { status, expose: true });

const sanitizePath = (path: string): string =>
  path.replace(/\/[a-f0-9]{24}(?=\/|$)/gi, '/:id');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: HttpError, req: Request, res: Response, _next: NextFunction): void => {
  const status = err.status ?? 500;
  const expose = err.expose !== false && status < 500;
  const message = expose ? err.message : 'Internal server error';

  const meta = { method: req.method, path: sanitizePath(req.path), status };
  if (status >= 500) {
    logger.error(`unhandled error: ${err.message}`, { ...meta, stack: err.stack });
  } else {
    logger.warn(`request failed: ${err.message}`, meta);
  }

  res.status(status).json({ message });
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info(`${req.method} ${sanitizePath(req.path)}`, { status: res.statusCode, ms });
  });
  next();
};
