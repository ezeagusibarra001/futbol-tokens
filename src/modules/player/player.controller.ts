import { Request, Response, NextFunction } from 'express';
import { getPlayerById, listPlayers, syncPlayersFromScrapper } from './player.service';

export const getPlayersHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { league, team, position } = req.query as { league?: string; team?: string; position?: string };
    const players = await listPlayers({ league, team, position });
    res.status(200).json(players);
  } catch (err) {
    next(err);
  }
};

export const getPlayerByIdHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string | undefined;
    if (!id) {
      res.status(400).json({ message: 'id is required' });
      return;
    }
    const player = await getPlayerById(id);
    if (!player) {
      res.status(404).json({ message: 'Player not found' });
      return;
    }
    res.status(200).json(player);
  } catch (err) {
    next(err);
  }
};

export const syncPlayersHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { league, team } = req.body as { league?: string; team?: string };
    if (!league || !team) {
      res.status(400).json({ message: 'league and team are required' });
      return;
    }
    const count = await syncPlayersFromScrapper(league, team);
    res.status(200).json({ upserted: count });
  } catch (err) {
    next(err);
  }
};
