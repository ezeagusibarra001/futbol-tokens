import { Types } from 'mongoose';
import { getPortfolio, getUserTransactions } from '../../portfolio.service';
import * as holdingRepo from '../../holding.repository';
import * as orderRepo from '../../order.repository';
import * as quoteRepo from '../../../quote/quote.repository';
import { Player } from '../../../player/player.model';

jest.mock('../../holding.repository');
jest.mock('../../order.repository');
jest.mock('../../../quote/quote.repository');

const mkLeanFind = (docs: unknown[]) => ({
  lean: () => ({ exec: () => Promise.resolve(docs) }),
});

beforeEach(() => jest.clearAllMocks());

describe('portfolio.service', () => {
  it('returns empty summary when user has no holdings', async () => {
    (holdingRepo.findHoldingsByUser as jest.Mock).mockResolvedValue([]);
    const res = await getPortfolio('u1');
    expect(res.positions).toEqual([]);
    expect(res.totals).toEqual({ invested: 0, currentValue: 0, pnl: 0, pnlPct: 0 });
  });

  it('computes positions with current price, P&L and totals', async () => {
    const playerId = new Types.ObjectId();
    (holdingRepo.findHoldingsByUser as jest.Mock).mockResolvedValue([
      { playerId, tokens: 10, avgBuyPrice: 5 },
    ]);
    jest.spyOn(Player, 'find').mockReturnValueOnce(mkLeanFind([
      { _id: playerId, name: 'Mbappe', team: 'PSG', league: 'Ligue 1' },
    ]) as unknown as ReturnType<typeof Player.find>);
    const quotes = new Map<string, { value: number }>();
    quotes.set(playerId.toString(), { value: 12 });
    (quoteRepo.findLatestQuotesForPlayers as jest.Mock).mockResolvedValue(quotes);

    const res = await getPortfolio('u1');

    expect(res.positions).toHaveLength(1);
    const pos = res.positions[0]!;
    expect(pos.playerName).toBe('Mbappe');
    expect(pos.currentPrice).toBe(12);
    expect(pos.investedValue).toBe(50);
    expect(pos.currentValue).toBe(120);
    expect(pos.pnl).toBe(70);
    expect(pos.pnlPct).toBe(140);
    expect(res.totals).toEqual({ invested: 50, currentValue: 120, pnl: 70, pnlPct: 140 });
  });

  it('falls back to avgBuyPrice as current price when no quote exists', async () => {
    const playerId = new Types.ObjectId();
    (holdingRepo.findHoldingsByUser as jest.Mock).mockResolvedValue([
      { playerId, tokens: 4, avgBuyPrice: 7 },
    ]);
    jest.spyOn(Player, 'find').mockReturnValueOnce(mkLeanFind([
      { _id: playerId, name: 'X', team: 'T', league: 'L' },
    ]) as unknown as ReturnType<typeof Player.find>);
    (quoteRepo.findLatestQuotesForPlayers as jest.Mock).mockResolvedValue(new Map());

    const res = await getPortfolio('u1');
    expect(res.positions[0]?.currentPrice).toBe(7);
    expect(res.totals.pnl).toBe(0);
    expect(res.totals.pnlPct).toBe(0);
  });

  it('getUserTransactions delegates to order repo', async () => {
    (orderRepo.findOrdersByUser as jest.Mock).mockResolvedValue([{ _id: 'o' }]);
    const res = await getUserTransactions('u1');
    expect(orderRepo.findOrdersByUser).toHaveBeenCalledWith('u1');
    expect(res).toEqual([{ _id: 'o' }]);
  });
});
