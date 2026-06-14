import { Router } from 'express';
import {
  healthHandler,
  liveHandler,
  readyHandler,
  metricsHandler,
  infoHandler,
  statsHandler,
} from './monitor.controller';

/**
 * @swagger
 * tags:
 *   name: Monitor
 *   description: Health checks and monitoring endpoints
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check (includes DB status)
 *     tags: [Monitor]
 *     responses:
 *       200: { description: Service healthy }
 *       503: { description: Service degraded (DB disconnected) }
 *
 * /health/live:
 *   get:
 *     summary: Liveness probe (process alive)
 *     tags: [Monitor]
 *     responses:
 *       200: { description: Process is alive }
 *
 * /health/ready:
 *   get:
 *     summary: Readiness probe (accepting traffic)
 *     tags: [Monitor]
 *     responses:
 *       200: { description: Ready to accept traffic }
 *       503: { description: Not ready }
 *
 * /metrics:
 *   get:
 *     summary: Prometheus metrics endpoint
 *     tags: [Monitor]
 *     responses:
 *       200: { description: Prometheus-formatted metrics }
 *
 * /monitor/info:
 *   get:
 *     summary: System information (node, platform, memory, CPU)
 *     tags: [Monitor]
 *     responses:
 *       200: { description: System info }
 *
 * /monitor/stats:
 *   get:
 *     summary: Process stats (uptime, memory, PID)
 *     tags: [Monitor]
 *     responses:
 *       200: { description: Process stats }
 */

const router = Router();

router.get('/health', healthHandler);
router.get('/health/live', liveHandler);
router.get('/health/ready', readyHandler);
router.get('/metrics', metricsHandler);
router.get('/monitor/info', infoHandler);
router.get('/monitor/stats', statsHandler);

export default router;
