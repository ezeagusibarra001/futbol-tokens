import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { buy, createSellPost, cancelSellPost, getSellPosts, createBid, cancelBid, getBids } from './order.service';
import { tokenTradesTotal } from '../monitor/monitor.service';

const getUserId = (req: AuthRequest): string | null => req.userId ?? null;

export const buyHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }
    const { playerId, tokens, sellOrderId } = req.body as { playerId?: string; tokens?: number; sellOrderId?: string };
    if (!playerId || tokens == null) {
      res.status(400).json({ message: 'playerId and tokens are required' });
      return;
    }
    const idempotencyKey = req.header('Idempotency-Key') ?? undefined;
    const result = await buy(userId, playerId, Number(tokens), idempotencyKey, sellOrderId);
    res.status(201).json(result);

    tokenTradesTotal.inc({ side: 'buy', player_id: playerId }, Number(tokens));
  } catch (err) {
    next(err);
  }
};

export const createSellPostHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }
    const { playerId, tokens } = req.body as { playerId?: string; tokens?: number };
    if (!playerId || tokens == null) {
      res.status(400).json({ message: 'playerId and tokens are required' });
      return;
    }
    const order = await createSellPost(userId, playerId, Number(tokens));
    res.status(201).json(order);

    tokenTradesTotal.inc({ side: 'sell', player_id: playerId }, Number(tokens));
  } catch (err) {
    next(err);
  }
};

export const cancelSellPostHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }
    const { id } = req.params as { id?: string };
    if (!id) { res.status(400).json({ message: 'sellOrderId param is required' }); return; }
    const order = await cancelSellPost(userId, id);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

export const getSellPostsHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const playerId = req.query.playerId as string | undefined;
    const posts = await getSellPosts(playerId);
    res.json(posts);
  } catch (err) {
    next(err);
  }
};

export const createBidHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }
    const { playerId, tokens } = req.body as { playerId?: string; tokens?: number };
    if (!playerId || tokens == null) {
      res.status(400).json({ message: 'playerId and tokens are required' });
      return;
    }
    const result = await createBid(userId, playerId, Number(tokens));
    res.status(201).json(result);

    if (result.filled > 0) tokenTradesTotal.inc({ side: 'buy', player_id: playerId }, result.filled);
  } catch (err) {
    next(err);
  }
};

export const cancelBidHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }
    const { id } = req.params as { id?: string };
    if (!id) { res.status(400).json({ message: 'bidId param is required' }); return; }
    const order = await cancelBid(userId, id);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

export const getBidsHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const playerId = req.query.playerId as string | undefined;
    const bids = await getBids(playerId);
    res.json(bids);
  } catch (err) {
    next(err);
  }
};