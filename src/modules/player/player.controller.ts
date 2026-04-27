import { Request, Response, NextFunction } from 'express';
import { getPlayers } from './player.service';

export const getPlayersHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { league, team, position } = req.query as { league: string; team: string; position?: string };
    if (!league || !team) {
      res.status(400).json({ message: 'league and team are required' });
      return;
    };
    const players = await getPlayers(league, team, position);
    res.status(200).json(players);
  }
    catch (err) {
        next(err);
    }
};