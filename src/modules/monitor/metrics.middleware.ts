import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal, httpErrorsTotal } from './monitor.service';

const sanitizePath = (path: string): string =>
  path.replace(/\/[a-f0-9]{24}(?=\/|$)/gi, '/:id');

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const path = sanitizePath(req.path);
    const status = res.statusCode.toString();
    const labels = { method: req.method, path, status };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }
  });

  next();
};
