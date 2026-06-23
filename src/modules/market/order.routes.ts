import { Router } from 'express';
import { buyHandler, createSellPostHandler, cancelSellPostHandler, getSellPostsHandler, createBidHandler, getBidsHandler, cancelBidHandler } from './order.controller';
import { authenticate } from '../auth/auth.middleware';

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Buy and sell player tokens
 */

/**
 * @swagger
 * /orders/sell:
 *   post:
 *     summary: Create a sell post. Tokens are moved to escrow and listed for others to buy.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
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
 *       201: { description: Sell post created }
 *       400: { description: Bad request }
 *       409: { description: Insufficient token balance }
 *
 * /orders/buy:
 *   post:
 *     summary: Buy tokens. If sellOrderId is provided, buys from that specific sell post.
 *       Otherwise checks for matching active sell posts first, then falls back to the superuser.
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
 *               sellOrderId: { type: string, description: 'Optional: buy from a specific sell post' }
 *     responses:
 *       201:
 *         description: Order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 source: { type: string, enum: [p2p, superuser] }
 *                 order: { $ref: '#/components/schemas/Order' }
 *       400: { description: Bad request }
 *       409: { description: Not enough tokens }
 *
 * /orders/sell-posts:
 *   get:
 *     summary: List active sell posts, optionally filtered by player
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: playerId
 *         schema: { type: string }
 *         required: false
 *         description: Filter by player ID
 *     responses:
 *       200:
 *         description: Active sell posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *
 * /orders/sell-posts/{id}/cancel:
 *   patch:
 *     summary: Cancel your own sell post and get tokens back from escrow
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Sell post cancelled }
 *       403: { description: Not your sell post }
 *       404: { description: Active sell post not found }
 *
 * /orders/bid:
 *   post:
 *     summary: Place a buy order (bid). Matches active sell posts at the current quote; the unfilled remainder rests as an ACTIVE bid.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
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
 *       201:
 *         description: Bid placed (fully/partially filled or fully pending)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 source: { type: string, enum: [p2p, pending] }
 *                 filled: { type: integer }
 *                 order: { $ref: '#/components/schemas/Order' }
 *
 * /orders/bids:
 *   get:
 *     summary: List active bids, optionally filtered by player
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: playerId
 *         schema: { type: string }
 *         required: false
 *     responses:
 *       200:
 *         description: Active bids
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *
 * /orders/bids/{id}/cancel:
 *   patch:
 *     summary: Cancel your own active bid
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Bid cancelled }
 *       403: { description: Not your bid }
 *       404: { description: Active bid not found }
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         userId: { type: string }
 *         playerId: { type: string }
 *         side: { type: string, enum: [BUY, SELL] }
 *         tokens: { type: integer }
 *         remainingTokens: { type: integer }
 *         pricePerToken: { type: number }
 *         total: { type: number }
 *         status: { type: string, enum: [ACTIVE, FILLED, CANCELLED] }
 *         idempotencyKey: { type: string }
 *         strategyName: { type: string }
 *         strategyVersion: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

const router = Router();
router.post('/buy', authenticate, buyHandler);
router.post('/sell', authenticate, createSellPostHandler);
router.get('/sell-posts', authenticate, getSellPostsHandler);
router.patch('/sell-posts/:id/cancel', authenticate, cancelSellPostHandler);
router.post('/bid', authenticate, createBidHandler);
router.get('/bids', authenticate, getBidsHandler);
router.patch('/bids/:id/cancel', authenticate, cancelBidHandler);
export default router;