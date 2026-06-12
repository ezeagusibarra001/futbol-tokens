import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth/auth.middleware';
import { getPortfolio, getUserTransactions } from '../market/portfolio.service';

const assertSelf = (req: AuthRequest): string | null => {
  const paramId = req.params['id'] as string | undefined;
  if (!paramId) return null;
  if (req.userId !== paramId) return null;
  return paramId;
};

export const getPortfolioHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = assertSelf(req);
    if (!id) {
      res.status(403).json({ message: 'You can only access your own portfolio' });
      return;
    }
    const portfolio = await getPortfolio(id);
    res.status(200).json(portfolio);
  } catch (err) {
    next(err);
  }
};

export const getTransactionsHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = assertSelf(req);
    if (!id) {
      res.status(403).json({ message: 'You can only access your own transactions' });
      return;
    }
    const tx = await getUserTransactions(id);
    res.status(200).json(tx);
  } catch (err) {
    next(err);
  }
};

export const getMyPortfolioHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const portfolio = await getPortfolio(req.userId);
    res.status(200).json(portfolio);
  } catch (err) {
    next(err);
  }
};

export const getMyTransactionsHandler = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const tx = await getUserTransactions(req.userId);
    res.status(200).json(tx);
  } catch (err) {
    next(err);
  }
};
