import { Router } from 'express';
import {
  healthHandler,
  liveHandler,
  readyHandler,
  metricsHandler,
  infoHandler,
  statsHandler,
} from './monitor.controller';

const router = Router();

router.get('/health', healthHandler);
router.get('/health/live', liveHandler);
router.get('/health/ready', readyHandler);
router.get('/metrics', metricsHandler);
router.get('/monitor/info', infoHandler);
router.get('/monitor/stats', statsHandler);

export default router;
