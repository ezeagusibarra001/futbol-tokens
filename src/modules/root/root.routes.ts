import { Router } from 'express';
import { getRoot } from './root.controller';

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check
 *     tags: [Root]
 *     responses:
 *       200:
 *         description: API running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

const router = Router();

router.get('/', getRoot);

export default router;
