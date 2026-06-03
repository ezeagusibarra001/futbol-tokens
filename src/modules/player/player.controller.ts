import { Request, Response, NextFunction } from 'express';
import { getPlayerById, listPlayers, syncPlayersFromScrapperByLeague, syncPlayersFromScrapperFromTeamAndLeague } from './player.service';

const asString = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;

export const getPlayersHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const players = await listPlayers({
      league: asString(req.query.league),
      team: asString(req.query.team),
      position: asString(req.query.position),
    });
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
    const league = asString(req.body.league);
    const team = asString(req.body.team);
    if (!league) {
      res.status(400).json({ message: 'league is required' });
      return;
    }
    let count: number;
    if (!team) {
      count = await syncPlayersFromScrapperByLeague(league);
    } 
    else { 
      count = await syncPlayersFromScrapperFromTeamAndLeague(league, team);
    }
    res.status(200).json({ upserted: count });
  } catch (err) {
    next(err);
  }
};
