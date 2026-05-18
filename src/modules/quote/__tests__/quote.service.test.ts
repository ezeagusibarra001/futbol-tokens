import { Types } from 'mongoose';
import { recalculateAll, getRanking, computeOnDemand, getPlayerQuotes } from '../quote.service';
import * as playerRepo from '../../player/player.repository';
import * as quoteRepo from '../quote.repository';

jest.mock('../../player/player.repository');
jest.mock('../quote.repository');

beforeEach(() => jest.clearAllMocks());

const mkPlayerDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  name: 'P',
  position: 'FW',
  league: 'PL',
  team: 'T',
  goals: 5,
  assists: 2,
  shots: 10,
  rating: 7,
  keyPasses: 3,
  dribbles: 4,
  tackles: 1,
  minutesPlayed: 900,
  yellowCards: 0,
  redCards: 0,
  ...overrides,
});

describe('quote.service', () => {
  it('recalculateAll computes quotes for every player and inserts them', async () => {
    const players = [mkPlayerDoc(), mkPlayerDoc({ goals: 20 })];
    (playerRepo.findPlayers as jest.Mock).mockResolvedValue(players);
    (quoteRepo.insertManyQuotes as jest.Mock).mockResolvedValue(2);

    const res = await recalculateAll();

    expect(playerRepo.findPlayers).toHaveBeenCalledWith({});
    const calledWith = (quoteRepo.insertManyQuotes as jest.Mock).mock.calls[0][0];
    expect(calledWith).toHaveLength(2);
    expect(calledWith[0]).toMatchObject({
      strategyName: 'PerformanceWeighted',
      strategyVersion: expect.any(String),
      score: expect.any(Number),
      value: expect.any(Number),
    });
    expect(res.quotesCreated).toBe(2);
    expect(res.strategy).toBe('PerformanceWeighted');
  });

  it('recalculateAll accepts a strategy name', async () => {
    (playerRepo.findPlayers as jest.Mock).mockResolvedValue([mkPlayerDoc()]);
    (quoteRepo.insertManyQuotes as jest.Mock).mockResolvedValue(1);
    const res = await recalculateAll('PositionAware');
    expect(res.strategy).toBe('PositionAware');
  });

  it('recalculateAll throws 400 for unknown strategy', async () => {
    await expect(recalculateAll('nope')).rejects.toMatchObject({ status: 400 });
  });

  it('getRanking sorts by latest quote value desc and includes players without quotes', async () => {
    const p1 = mkPlayerDoc();
    const p2 = mkPlayerDoc();
    const p3 = mkPlayerDoc();
    (playerRepo.findPlayers as jest.Mock).mockResolvedValue([p1, p2, p3]);
    const map = new Map<string, { value: number; playerId: Types.ObjectId }>();
    map.set(p1._id.toString(), { value: 50, playerId: p1._id });
    map.set(p2._id.toString(), { value: 200, playerId: p2._id });
    (quoteRepo.findLatestQuotesForPlayers as jest.Mock).mockResolvedValue(map);

    const ranking = await getRanking();
    expect(ranking[0]?.quote?.value).toBe(200);
    expect(ranking[1]?.quote?.value).toBe(50);
    expect(ranking[2]?.quote).toBeNull();
  });

  it('getPlayerQuotes delegates with date range', async () => {
    (quoteRepo.findQuotesByPlayer as jest.Mock).mockResolvedValue([]);
    const from = new Date('2025-01-01');
    const to = new Date('2025-12-31');
    await getPlayerQuotes('abc', from, to);
    expect(quoteRepo.findQuotesByPlayer).toHaveBeenCalledWith('abc', from, to);
  });

  it('computeOnDemand throws 404 when player not found', async () => {
    (playerRepo.findPlayerById as jest.Mock).mockResolvedValue(null);
    await expect(computeOnDemand('x')).rejects.toMatchObject({ status: 404 });
  });

  it('computeOnDemand returns score+value for an existing player', async () => {
    const p = mkPlayerDoc({ goals: 20, rating: 8.5 });
    (playerRepo.findPlayerById as jest.Mock).mockResolvedValue(p);
    const res = await computeOnDemand(p._id.toString());
    expect(res.score).toBeGreaterThan(0);
    expect(res.value).toBeGreaterThan(1);
    expect(res.strategy).toBe('PerformanceWeighted');
  });
});
