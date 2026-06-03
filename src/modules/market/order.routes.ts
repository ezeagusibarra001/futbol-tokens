import { Router } from 'express';
import { buyHandler, sellHandler } from './order.controller';
import { authenticate } from '../auth/auth.middleware';

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Buy and sell player tokens
 */

/**
 * @swagger
 * /orders/buy:
 *   post:
 *     summary: Buy tokens of a player from the superuser at the current quote
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *         required: false
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [playerId, tokens]
 *             properties:
 *               playerId: { type: string }
 *               tokens: { type: integer, minimum: 1 }
 *     responses:
 *       201: { description: Order created }
 *       400: { description: Bad request }
 *       409: { description: Not enough tokens available }
 *
 * /orders/sell:
 *   post:
 *     summary: Sell tokens of a player back to the superuser at the current quote
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *         required: false
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [playerId, tokens]
 *             properties:
 *               playerId: { type: string }
 *               tokens: { type: integer, minimum: 1 }
 *     responses:
 *       201: { description: Order created }
 *       400: { description: Bad request }
 *       409: { description: Insufficient token balance to sell }
 */

const router = Router();
router.post('/buy', authenticate, buyHandler);
router.post('/sell', authenticate, sellHandler);
export default router;
