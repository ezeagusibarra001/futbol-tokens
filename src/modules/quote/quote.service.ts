import { findPlayers, findPlayerById } from '../player/player.repository';
import { IPlayerDoc } from '../player/player.model';
import {
  findLatestQuoteForPlayer,
  findLatestQuotesForPlayers,
  findQuotesByPlayer,
  insertManyQuotes,
  insertQuote,
} from './quote.repository';
import { IQuote, IQuoteDoc } from './quote.model';
import { DEFAULT_STRATEGY, getStrategy } from './strategies';

export type RecalculateResult = {
  strategy: string;
  version: string;
  quotesCreated: number;
  at: Date;
};

export const recalculateAll = async (strategyName?: string): Promise<RecalculateResult> => {
  const strategy = getStrategy(strategyName);
  const players = await findPlayers({});
  const at = new Date();

  const quotes: IQuote[] = players.map((p: IPlayerDoc) => {
    const score = strategy.score(p);
    const value = strategy.price(score);
    return {
      playerId: p._id,
      score,
      value,
      strategyName: strategy.name,
      strategyVersion: strategy.version,
      at,
    };
  });

  const created = await insertManyQuotes(quotes);
  return { strategy: strategy.name, version: strategy.version, quotesCreated: created, at };
};

export const getPlayerQuotes = (playerId: string, from?: Date, to?: Date): Promise<IQuoteDoc[]> =>
  findQuotesByPlayer(playerId, from, to);

export const getLatestQuoteForPlayer = (playerId: string): Promise<IQuoteDoc | null> =>
  findLatestQuoteForPlayer(playerId);

export type RankingEntry = {
  player: IPlayerDoc;
  quote: IQuoteDoc | null;
};

export const getRanking = async (limit = 50): Promise<RankingEntry[]> => {
  const players = await findPlayers({});
  const ids = players.map(p => p._id);
  const latest = await findLatestQuotesForPlayers(ids);

  const entries: RankingEntry[] = players.map(p => ({
    player: p,
    quote: latest.get(p._id.toString()) ?? null,
  }));

  entries.sort((a, b) => (b.quote?.value ?? 0) - (a.quote?.value ?? 0));
  return entries.slice(0, limit);
};

export type EffectivePrice = {
  value: number;
  strategyName: string;
  strategyVersion: string;
};

export const getEffectivePrice = async (playerId: string, strategyName = DEFAULT_STRATEGY): Promise<EffectivePrice> => {
  const latest = await findLatestQuoteForPlayer(playerId);
  if (latest) {
    return { value: latest.value, strategyName: latest.strategyName, strategyVersion: latest.strategyVersion };
  }
  const od = await computeOnDemand(playerId, strategyName);
  await insertQuote({
    playerId: od.playerId,
    score: od.score,
    value: od.value,
    strategyName: od.strategy,
    strategyVersion: od.version,
    at: new Date(),
  });
  return { value: od.value, strategyName: od.strategy, strategyVersion: od.version };
};

export const computeOnDemand = async (playerId: string, strategyName = DEFAULT_STRATEGY) => {
  const player = await findPlayerById(playerId);
  if (!player) throw Object.assign(new Error('Player not found'), { status: 404 });
  const strategy = getStrategy(strategyName);
  const score = strategy.score(player);
  const value = strategy.price(score);
  return { playerId: player._id, score, value, strategy: strategy.name, version: strategy.version };
};
