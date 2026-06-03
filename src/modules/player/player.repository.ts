import { Types } from 'mongoose';
import { Player, IPlayer, IPlayerDoc } from './player.model';

export interface PlayerFilters {
  league?: string;
  team?: string;
  position?: string;
}

const KNOWN_FIELDS: (keyof IPlayer)[] = [
  'externalId', 'name', 'position', 'league', 'team',
  'goals', 'assists', 'shots', 'rating', 'keyPasses',
  'dribbles', 'tackles', 'minutesPlayed', 'yellowCards', 'redCards',
];

const pickKnown = (data: IPlayer): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const k of KNOWN_FIELDS) {
    if (data[k] !== undefined) {
      out[k] = data[k];
    }
  }
  return out;
};

const asStringOr = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback;

export const findPlayers = (filters: PlayerFilters = {}): Promise<IPlayerDoc[]> => {
  let query = Player.find();
  if (typeof filters.league === 'string' && filters.league) {
    query = query.where('league').equals(filters.league);
  }
  if (typeof filters.team === 'string' && filters.team) {
    query = query.where('team').equals(filters.team);
  }
  if (typeof filters.position === 'string' && filters.position) {
    query = query.where('position').equals(filters.position.toUpperCase());
  }
  return query.lean<IPlayerDoc[]>().exec();
};

export const findPlayerById = (id: string): Promise<IPlayerDoc | null> => {
  if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
  return Player.findById(id).lean<IPlayerDoc>().exec();
};

export const upsertPlayer = async (data: IPlayer): Promise<IPlayerDoc> => {
  const clean = pickKnown(data);
  const filter = clean.externalId
    ? { externalId: asStringOr(clean.externalId, '') }
    : { name: asStringOr(clean.name, ''), team: asStringOr(clean.team, ''), league: asStringOr(clean.league, '') };

  const doc = await Player.findOneAndUpdate(filter, { $set: clean }, {
    upsert: true,
    returnDocument: 'after',
    setDefaultsOnInsert: true,
  }).exec();
  return doc;
};

export const bulkUpsertPlayers = async (players: IPlayer[]): Promise<number> => {
  if (!players.length) return 0;
  const ops = players.map(p => {
    const clean = pickKnown(p);
    const filter = clean.externalId
      ? { externalId: asStringOr(clean.externalId, '') }
      : { name: asStringOr(clean.name, ''), team: asStringOr(clean.team, ''), league: asStringOr(clean.league, '') };
    return {
      updateOne: {
        filter,
        update: { $set: clean },
        upsert: true,
      },
    };
  });
  const res = await Player.bulkWrite(ops);
  return (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);
};
