import { Request, Response } from 'express';
import { getWelcomeMessage } from '../services/rootService';

export const getRoot = (req: Request, res: Response) => {
  res.json({ message: getWelcomeMessage() });
};
