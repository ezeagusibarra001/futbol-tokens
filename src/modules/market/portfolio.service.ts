import { Types } from 'mongoose';
import { findHoldingsByUser } from './holding.repository';
import { findOrdersByUser } from './order.repository';
import { findLatestQuotesForPlayers } from '../quote/quote.repository';
import { Player, IPlayerDoc } from '../player/player.model';
import { IOrderDoc } from './order.model';

export type PortfolioPosition = {
  playerId: Types.ObjectId;
  playerName: string;
  team: string;
  league: string;
  tokens: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  investedValue: number;
  pnl: number;
  pnlPct: number;
};

export type PortfolioSummary = {
  positions: PortfolioPosition[];
  totals: {
    invested: number;
    currentValue: number;
    pnl: number;
    pnlPct: number;
  };
};

const r = (n: number) => Number(n.toFixed(6));

export const getPortfolio = async (userId: string): Promise<PortfolioSummary> => {
  const holdings = await findHoldingsByUser(userId);
  if (!holdings.length) {
    return { positions: [], totals: { invested: 0, currentValue: 0, pnl: 0, pnlPct: 0 } };
  }

  const playerIds = holdings.map(h => h.playerId);
  const [players, latestQuotes] = await Promise.all([
    Player.find({ _id: { $in: playerIds } }).lean<IPlayerDoc[]>().exec(),
    findLatestQuotesForPlayers(playerIds),
  ]);
  const byId = new Map<string, IPlayerDoc>(players.map(p => [p._id.toString(), p]));

  let totalInvested = 0;
  let totalCurrent = 0;

  const positions: PortfolioPosition[] = holdings.map(h => {
    const p = byId.get(h.playerId.toString());
    const quote = latestQuotes.get(h.playerId.toString());
    const currentPrice = quote?.value ?? h.avgBuyPrice;
    const invested = h.avgBuyPrice * h.tokens;
    const current = currentPrice * h.tokens;
    const pnl = current - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    totalInvested += invested;
    totalCurrent += current;
    return {
      playerId: h.playerId,
      playerName: p?.name ?? 'unknown',
      team: p?.team ?? '',
      league: p?.league ?? '',
      tokens: h.tokens,
      avgBuyPrice: r(h.avgBuyPrice),
      currentPrice: r(currentPrice),
      currentValue: r(current),
      investedValue: r(invested),
      pnl: r(pnl),
      pnlPct: r(pnlPct),
    };
  });

  const pnl = totalCurrent - totalInvested;
  const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

  return {
    positions,
    totals: {
      invested: r(totalInvested),
      currentValue: r(totalCurrent),
      pnl: r(pnl),
      pnlPct: r(pnlPct),
    },
  };
};

export const getUserTransactions = (userId: string): Promise<IOrderDoc[]> => findOrdersByUser(userId);
