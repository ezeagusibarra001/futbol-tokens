import { Router } from 'express';
import { recalculateHandler } from './quote.controller';
import { authenticate } from '../auth/auth.middleware';

/**
 * @swagger
 * tags:
 *   name: Quotes
 *   description: Player quote recalculation and history
 */

/**
 * @swagger
 * /quotes/recalculate:
 *   post:
 *     summary: Trigger a recalculation of every player's quote using the given (or default) strategy
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               strategy:
 *                 type: string
 *                 enum: [PerformanceWeighted, PositionAware]
 *     responses:
 *       200:
 *         description: Number of quotes created and strategy used
 */

const router = Router();
router.post('/recalculate', authenticate, recalculateHandler);
export default router;
