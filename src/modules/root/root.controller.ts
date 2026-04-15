import { Request, Response } from 'express';
import { getWelcomeMessage } from './root.service';

export const getRoot = (_req: Request, res: Response): void => {
  res.json({ message: getWelcomeMessage() });
};
