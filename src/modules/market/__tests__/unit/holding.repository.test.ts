import { Types, ClientSession } from 'mongoose';
import { Holding } from '../../holding.model';
import {
  findHoldingsByUser,
  findHolding,
  ensureHolding,
  bulkEnsureHoldings,
} from '../../holding.repository';

jest.mock('../../holding.model');

const uid = new Types.ObjectId();
const pid = new Types.ObjectId();

describe('holding.repository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findHoldingsByUser', () => {
    it('returns empty array for invalid ObjectId', async () => {
      const result = await findHoldingsByUser('bad-id');
      expect(result).toEqual([]);
      expect(Holding.find).not.toHaveBeenCalled();
    });

    it('queries by userId for valid id', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      (Holding.find as jest.Mock).mockReturnValue({ lean: () => ({ exec: mockExec }) });

      await findHoldingsByUser(uid.toString());

      const query = (Holding.find as jest.Mock).mock.calls[0][0];
      expect(query.userId).toBeInstanceOf(Types.ObjectId);
    });
  });

  describe('findHolding', () => {
    const queryObj = () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      return { session: jest.fn().mockReturnThis(), exec: mockExec };
    };

    it('queries without session when not provided', async () => {
      const q = queryObj();
      (Holding.findOne as jest.Mock).mockReturnValue(q);

      await findHolding(uid, pid);

      expect(Holding.findOne).toHaveBeenCalledWith({ userId: uid, playerId: pid });
      expect(q.session).not.toHaveBeenCalled();
    });

    it('attaches session when provided', async () => {
      const q = queryObj();
      (Holding.findOne as jest.Mock).mockReturnValue(q);

      const ses = { id: 1 } as unknown as ClientSession;
      await findHolding(uid, pid, ses);

      expect(q.session).toHaveBeenCalledWith(ses);
    });
  });

  describe('ensureHolding', () => {
    it('upserts with $setOnInsert', async () => {
      const mockExec = jest.fn().mockResolvedValue({ userId: uid, playerId: pid, tokens: 100, avgBuyPrice: 0 });
      (Holding.findOneAndUpdate as jest.Mock).mockReturnValue({ exec: mockExec });

      const result = await ensureHolding(uid, pid, 100);

      const filter = (Holding.findOneAndUpdate as jest.Mock).mock.calls[0][0];
      const update = (Holding.findOneAndUpdate as jest.Mock).mock.calls[0][1];
      expect(filter.userId).toEqual(uid);
      expect(filter.playerId).toEqual(pid);
      expect(update).toEqual({ $setOnInsert: { tokens: 100, avgBuyPrice: 0 } });
      expect(result.tokens).toBe(100);
    });
  });

  describe('bulkEnsureHoldings', () => {
    it('returns 0 for empty array', async () => {
      const result = await bulkEnsureHoldings(uid, [], 100);
      expect(result).toBe(0);
      expect(Holding.bulkWrite).not.toHaveBeenCalled();
    });

    it('calls bulkWrite with upsert operations per playerId', async () => {
      const pids = [new Types.ObjectId(), new Types.ObjectId()];
      (Holding.bulkWrite as jest.Mock).mockResolvedValue({ upsertedCount: 2 });

      const result = await bulkEnsureHoldings(uid, pids, 100);

      expect(Holding.bulkWrite).toHaveBeenCalledWith(
        pids.map(pid => ({
          updateOne: {
            filter: { userId: uid, playerId: pid },
            update: { $setOnInsert: { userId: uid, playerId: pid, tokens: 100, avgBuyPrice: 0 } },
            upsert: true,
          },
        }))
      );
      expect(result).toBe(2);
    });
  });
});
