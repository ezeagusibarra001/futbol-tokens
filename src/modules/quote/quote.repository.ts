import { Types } from 'mongoose';
import { Quote, IQuote, IQuoteDoc } from './quote.model';

export const insertQuote = (q: IQuote): Promise<IQuoteDoc> => Quote.create(q);

export const insertManyQuotes = async (quotes: IQuote[]): Promise<number> => {
  if (!quotes.length) return 0;
  const res = await Quote.insertMany(quotes, { ordered: false });
  return res.length;
};

export const findQuotesByPlayer = (
  playerId: string,
  from?: Date,
  to?: Date
): Promise<IQuoteDoc[]> => {
  if (!Types.ObjectId.isValid(playerId)) return Promise.resolve([]);
  const query: Record<string, unknown> = { playerId: new Types.ObjectId(playerId) };
  if (from || to) {
    const at: Record<string, Date> = {};
    if (from) at['$gte'] = from;
    if (to) at['$lte'] = to;
    query['at'] = at;
  }
  return Quote.find(query).sort({ at: -1 }).lean<IQuoteDoc[]>().exec();
};

export const findLatestQuoteForPlayer = (playerId: string): Promise<IQuoteDoc | null> => {
  if (!Types.ObjectId.isValid(playerId)) return Promise.resolve(null);
  return Quote.findOne({ playerId: new Types.ObjectId(playerId) })
    .sort({ at: -1 })
    .lean<IQuoteDoc>()
    .exec();
};

export const findLatestQuotesForPlayers = async (
  playerIds: Types.ObjectId[]
): Promise<Map<string, IQuoteDoc>> => {
  if (!playerIds.length) return new Map();
  const docs = await Quote.aggregate<IQuoteDoc>([
    { $match: { playerId: { $in: playerIds } } },
    { $sort: { at: -1 } },
    { $group: { _id: '$playerId', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
  ]).exec();
  const map = new Map<string, IQuoteDoc>();
  for (const d of docs) map.set(d.playerId.toString(), d);
  return map;
};
