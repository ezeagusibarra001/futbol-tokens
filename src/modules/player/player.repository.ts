import { Types } from 'mongoose';
import { Player, IPlayer, IPlayerDoc } from './player.model';

type FilterQuery = Record<string, unknown>;

export interface PlayerFilters {
  league?: string;
  team?: string;
  position?: string;
}

export const findPlayers = (filters: PlayerFilters = {}): Promise<IPlayerDoc[]> => {
  const query: FilterQuery = {};
  if (filters.league) query.league = filters.league;
  if (filters.team) query.team = filters.team;
  if (filters.position) query.position = new RegExp(`^${filters.position}$`, 'i');
  return Player.find(query).lean<IPlayerDoc[]>().exec();
};

export const findPlayerById = (id: string): Promise<IPlayerDoc | null> => {
  if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
  return Player.findById(id).lean<IPlayerDoc>().exec();
};

export const upsertPlayer = async (data: IPlayer): Promise<IPlayerDoc> => {
  const filter = data.externalId
    ? { externalId: data.externalId }
    : { name: data.name, team: data.team, league: data.league };

  const doc = await Player.findOneAndUpdate(filter, { $set: data }, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  }).exec();
  return doc;
};

export const bulkUpsertPlayers = async (players: IPlayer[]): Promise<number> => {
  if (!players.length) return 0;
  const ops = players.map(p => ({
    updateOne: {
      filter: p.externalId
        ? { externalId: p.externalId }
        : { name: p.name, team: p.team, league: p.league },
      update: { $set: p },
      upsert: true,
    },
  }));
  const res = await Player.bulkWrite(ops);
  return (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);
};
