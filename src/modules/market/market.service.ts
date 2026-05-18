import { Types } from 'mongoose';
import { User } from '../auth/user.model';
import { Player } from '../player/player.model';
import { bulkEnsureHoldings } from './holding.repository';

export const INITIAL_TOKENS_PER_PLAYER = 100;

export const getSuperuser = async () => {
  const su = await User.findOne({ isSuperuser: true }).exec();
  if (!su) throw Object.assign(new Error('Superuser not found. Run the seed.'), { status: 500 });
  return su;
};

export const ensureInitialHoldingsForPlayers = async (
  playerIds: Types.ObjectId[]
): Promise<number> => {
  if (!playerIds.length) return 0;
  const su = await getSuperuser();
  return bulkEnsureHoldings(su._id as Types.ObjectId, playerIds, INITIAL_TOKENS_PER_PLAYER);
};

export const ensureInitialHoldingsForAllPlayers = async (): Promise<number> => {
  const players = await Player.find({}).select('_id').lean<{ _id: Types.ObjectId }[]>().exec();
  return ensureInitialHoldingsForPlayers(players.map(p => p._id));
};
