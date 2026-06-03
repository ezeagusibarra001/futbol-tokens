import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { buy, sell } from './order.service';

const getUserId = (req: AuthRequest): string | null => req.userId ?? null;

const buildHandler = (action: typeof buy) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const { playerId, tokens } = req.body as { playerId?: string; tokens?: number };
      if (!playerId || tokens == null) {
        res.status(400).json({ message: 'playerId and tokens are required' });
        return;
      }
      const idempotencyKey = req.header('Idempotency-Key') ?? undefined;
      const order = await action(userId, playerId, Number(tokens), idempotencyKey);
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  };

export const buyHandler = buildHandler(buy);
export const sellHandler = buildHandler(sell);
