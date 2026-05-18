import { Router } from 'express';
import { getPlayerByIdHandler, getPlayersHandler, syncPlayersHandler } from './player.controller';
import { getPlayerQuotesHandler, getRankingHandler } from '../quote/quote.controller';
import { authenticate } from '../auth/auth.middleware';

/**
 * @swagger
 * tags:
 *   name: Players
 *   description: Endpoints for retrieving player information
 */

/**
 * @swagger
 * /players:
 *   get:
 *     summary: List players (filterable by league, team, position)
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: league
 *         schema: { type: string }
 *       - in: query
 *         name: team
 *         schema: { type: string }
 *       - in: query
 *         name: position
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of players
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Player'
 *
 * /players/{id}:
 *   get:
 *     summary: Get a player by id
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Player detail
 *       404:
 *         description: Player not found
 *
 * /players/ranking:
 *   get:
 *     summary: Ranking of players ordered by current quote value
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: Ranked list of players with their latest quote }
 *
 * /players/{id}/quotes:
 *   get:
 *     summary: Quote history for a player
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: List of historical quotes ordered by date desc }
 *
 * /players/sync:
 *   post:
 *     summary: Trigger a scrape+upsert for a given league and team
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [league, team]
 *             properties:
 *               league: { type: string }
 *               team: { type: string }
 *     responses:
 *       200: { description: Number of players upserted }
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Player:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         name: { type: string }
 *         position: { type: string }
 *         league: { type: string }
 *         team: { type: string }
 *         goals: { type: number }
 *         assists: { type: number }
 *         shots: { type: number }
 *         keyPasses: { type: number }
 *         dribbles: { type: number }
 *         tackles: { type: number }
 *         rating: { type: number }
 *         minutesPlayed: { type: number }
 *         yellowCards: { type: number }
 *         redCards: { type: number }
 */

const router = Router();

router.get('/', authenticate, getPlayersHandler);
router.post('/sync', authenticate, syncPlayersHandler);
router.get('/ranking', authenticate, getRankingHandler);
router.get('/:id/quotes', authenticate, getPlayerQuotesHandler);
router.get('/:id', authenticate, getPlayerByIdHandler);

export default router;
