import { Router } from 'express';
import { resetHandler, advanceTimeHandler } from './demo.controller';

/**
 * @swagger
 * tags:
 *   name: Demo
 *   description: Endpoints de apoyo para la demo interactiva (no son parte de la API pública)
 */

/**
 * @swagger
 * /demo/reset:
 *   post:
 *     summary: Limpia y siembra el dataset demo (superusuario, 5 jugadores, holdings, 4 usuarios)
 *     tags: [Demo]
 *     responses:
 *       200: { description: Jugadores y usuarios demo creados }
 *
 * /demo/advance-time:
 *   post:
 *     summary: Pasa el tiempo y actualiza las stats de los jugadores demo
 *     tags: [Demo]
 *     responses:
 *       200: { description: Jugadores demo actualizados }
 */

const router = Router();
router.post('/reset', resetHandler);
router.post('/advance-time', advanceTimeHandler);
export default router;
