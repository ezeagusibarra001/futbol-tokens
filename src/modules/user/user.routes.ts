import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';
import {
  getPortfolioHandler,
  getTransactionsHandler,
  getMyPortfolioHandler,
  getMyTransactionsHandler,
} from './user.controller';

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User portfolio and transactions
 */

/**
 * @swagger
 * /users/{id}/portfolio:
 *   get:
 *     summary: Portfolio of a user (positions, current value, P&L)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Portfolio summary }
 *       403: { description: Cannot access another user's portfolio }
 *
 * /users/{id}/transactions:
 *   get:
 *     summary: Order history of a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of orders }
 *       403: { description: Cannot access another user's transactions }
 *
 * /me/portfolio:
 *   get:
 *     summary: Portfolio of the currently logged-in user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Portfolio summary }
 *
 * /me/transactions:
 *   get:
 *     summary: Order history of the currently logged-in user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: List of orders }
 */

const router = Router();
router.get('/me/portfolio', authenticate, getMyPortfolioHandler);
router.get('/me/transactions', authenticate, getMyTransactionsHandler);
router.get('/:id/portfolio', authenticate, getPortfolioHandler);
router.get('/:id/transactions', authenticate, getTransactionsHandler);

export const meRouter = Router();
meRouter.get('/portfolio', authenticate, getMyPortfolioHandler);
meRouter.get('/transactions', authenticate, getMyTransactionsHandler);

export default router;
