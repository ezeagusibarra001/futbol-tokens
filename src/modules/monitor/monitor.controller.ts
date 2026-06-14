import { Request, Response } from 'express';
import * as monitorService from './monitor.service';

export const healthHandler = async (_req: Request, res: Response): Promise<void> => {
  const health = await monitorService.healthCheck();
  const status = health.status === 'ok' ? 200 : 503;
  res.status(status).json(health);
};

export const liveHandler = (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'alive' });
};

export const readyHandler = async (_req: Request, res: Response): Promise<void> => {
  const health = await monitorService.healthCheck();
  if (health.status !== 'ok') {
    res.status(503).json({ status: 'not ready', reason: health.db });
    return;
  }
  res.status(200).json({ status: 'ready' });
};

export const metricsHandler = async (_req: Request, res: Response): Promise<void> => {
  res.set('Content-Type', monitorService.getMetricsContentType());
  res.send(await monitorService.getMetrics());
};

export const infoHandler = (_req: Request, res: Response): void => {
  res.json(monitorService.systemInfo());
};

export const statsHandler = (_req: Request, res: Response): void => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
    node: process.version,
  });
};
