import { Request, Response, NextFunction } from 'express';
import { resetAndSeed, advanceTime } from './demo.service';

export const resetHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await resetAndSeed();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const advanceTimeHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await advanceTime();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
