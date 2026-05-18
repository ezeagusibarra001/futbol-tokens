import { Request, Response, NextFunction } from 'express';
import { getPlayerQuotes, getRanking, recalculateAll } from './quote.service';

const parseDate = (v: unknown): Date | undefined => {
  if (typeof v !== 'string' || !v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

export const recalculateHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { strategy } = req.body as { strategy?: string };
    const result = await recalculateAll(strategy);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const getPlayerQuotesHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string | undefined;
    if (!id) {
      res.status(400).json({ message: 'id is required' });
      return;
    }
    const from = parseDate(req.query['from']);
    const to = parseDate(req.query['to']);
    const quotes = await getPlayerQuotes(id, from, to);
    res.status(200).json(quotes);
  } catch (err) {
    next(err);
  }
};

export const getRankingHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limitRaw = req.query['limit'];
    const limit = typeof limitRaw === 'string' ? Math.max(1, Math.min(500, Number(limitRaw) || 50)) : 50;
    const ranking = await getRanking(limit);
    res.status(200).json(ranking);
  } catch (err) {
    next(err);
  }
};
