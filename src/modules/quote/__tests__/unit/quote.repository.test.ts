import { Types } from 'mongoose';
import { Quote, IQuote } from '../../quote.model';
import {
  insertQuote,
  insertManyQuotes,
  findQuotesByPlayer,
  findLatestQuoteForPlayer,
  findLatestQuotesForPlayers,
} from '../../quote.repository';

jest.mock('../../quote.model');

const pid = new Types.ObjectId();

const mockQuote = (overrides: Partial<IQuote> = {}): IQuote => ({
  playerId: pid,
  value: 50,
  score: 0.5,
  strategyName: 'PerformanceWeighted',
  strategyVersion: '1.0',
  at: new Date(),
  ...overrides,
});

describe('quote.repository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('insertQuote', () => {
    it('calls Quote.create with the data', async () => {
      const data = mockQuote();
      (Quote.create as jest.Mock).mockResolvedValue(data);

      const result = await insertQuote(data);
      expect(Quote.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(data);
    });
  });

  describe('insertManyQuotes', () => {
    it('returns 0 for empty array', async () => {
      const result = await insertManyQuotes([]);
      expect(result).toBe(0);
      expect(Quote.insertMany).not.toHaveBeenCalled();
    });

    it('calls Quote.insertMany with ordered: false', async () => {
      const docs = [mockQuote()];
      (Quote.insertMany as jest.Mock).mockResolvedValue(docs);

      const result = await insertManyQuotes(docs);
      expect(Quote.insertMany).toHaveBeenCalledWith(docs, { ordered: false });
      expect(result).toBe(1);
    });
  });

  describe('findQuotesByPlayer', () => {
    it('returns empty array for invalid playerId', async () => {
      const result = await findQuotesByPlayer('bad-id');
      expect(result).toEqual([]);
      expect(Quote.find).not.toHaveBeenCalled();
    });

    it('queries with date range when from/to provided', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      (Quote.find as jest.Mock).mockReturnValue({ sort: () => ({ lean: () => ({ exec: mockExec }) }) });

      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      await findQuotesByPlayer(pid.toString(), from, to);

      const query = (Quote.find as jest.Mock).mock.calls[0][0];
      expect(query.playerId).toBeInstanceOf(Types.ObjectId);
      expect(query.at).toEqual({ $gte: from, $lte: to });
    });

    it('queries without date range when not provided', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      (Quote.find as jest.Mock).mockReturnValue({ sort: () => ({ lean: () => ({ exec: mockExec }) }) });

      await findQuotesByPlayer(pid.toString());

      const query = (Quote.find as jest.Mock).mock.calls[0][0];
      expect(query.at).toBeUndefined();
    });
  });

  describe('findLatestQuoteForPlayer', () => {
    it('returns null for invalid playerId', async () => {
      const result = await findLatestQuoteForPlayer('bad-id');
      expect(result).toBeNull();
      expect(Quote.findOne).not.toHaveBeenCalled();
    });

    it('queries by playerId sorted desc', async () => {
      const mockExec = jest.fn().mockResolvedValue(mockQuote());
      (Quote.findOne as jest.Mock).mockReturnValue({ sort: () => ({ lean: () => ({ exec: mockExec }) }) });

      const result = await findLatestQuoteForPlayer(pid.toString());
      expect(result).not.toBeNull();
    });
  });

  describe('findLatestQuotesForPlayers', () => {
    it('returns empty map for empty ids', async () => {
      const result = await findLatestQuotesForPlayers([]);
      expect(result.size).toBe(0);
      expect(Quote.aggregate).not.toHaveBeenCalled();
    });

    it('returns map keyed by playerId string', async () => {
      const pid1 = new Types.ObjectId();
      const pid2 = new Types.ObjectId();
      const doc1 = { ...mockQuote({ playerId: pid1 }), _id: new Types.ObjectId() };
      const doc2 = { ...mockQuote({ playerId: pid2 }), _id: new Types.ObjectId() };

      (Quote.aggregate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([doc1, doc2]),
      });

      const result = await findLatestQuotesForPlayers([pid1, pid2]);

      expect(result.get(pid1.toString())).toBeDefined();
      expect(result.get(pid2.toString())).toBeDefined();
      expect(result.size).toBe(2);
    });
  });
});
