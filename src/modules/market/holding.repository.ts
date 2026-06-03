import { ClientSession, Types } from 'mongoose';
import { Holding, IHoldingDoc } from './holding.model';

export const findHoldingsByUser = (userId: string): Promise<IHoldingDoc[]> => {
  if (!Types.ObjectId.isValid(userId)) return Promise.resolve([]);
  return Holding.find({ userId: new Types.ObjectId(userId) }).lean<IHoldingDoc[]>().exec();
};

export const findHolding = (
  userId: Types.ObjectId,
  playerId: Types.ObjectId,
  session?: ClientSession
): Promise<IHoldingDoc | null> => {
  const q = Holding.findOne({ userId, playerId });
  if (session) q.session(session);
  return q.exec();
};

export const ensureHolding = async (
  userId: Types.ObjectId,
  playerId: Types.ObjectId,
  tokens: number
): Promise<IHoldingDoc> => {
  const doc = await Holding.findOneAndUpdate(
    { userId, playerId },
    { $setOnInsert: { tokens, avgBuyPrice: 0 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).exec();
  return doc;
};

export const bulkEnsureHoldings = async (
  userId: Types.ObjectId,
  playerIds: Types.ObjectId[],
  tokens: number
): Promise<number> => {
  if (!playerIds.length) return 0;
  const ops = playerIds.map(pid => ({
    updateOne: {
      filter: { userId, playerId: pid },
      update: { $setOnInsert: { userId, playerId: pid, tokens, avgBuyPrice: 0 } },
      upsert: true,
    },
  }));
  const res = await Holding.bulkWrite(ops);
  return res.upsertedCount ?? 0;
};
