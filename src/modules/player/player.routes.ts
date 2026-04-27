import { Router } from 'express';
import { getPlayersHandler } from './player.controller';
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
 *     summary: Get players by league, team, and optional position
 *     tags: [Players]
 *     parameters:
 *       - in: query
 *         name: league
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: team
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: position
 *         schema:
 *           type: string
 *         required: false
 *     responses:
 *       200:
 *         description: List of players
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Player'
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Player:
 *       type: object
 *       properties:
 *         nombre:
 *           type: string
 *         posicion:
 *           type: string
 *         goals:
 *           type: number
 *         assists:
 *           type: number
 *         shots:
 *           type: number
 *         keyPasses:
 *           type: number
 *         dribbles:
 *           type: number
 *         tackles:
 *           type: number
 *         rating:
 *           type: number
 */

const router = Router();

router.get('/', authenticate, getPlayersHandler);

export default router;