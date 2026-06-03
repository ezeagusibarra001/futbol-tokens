import { Player, IPlayer } from '../../player.model';
import {
  findPlayers,
  findPlayerById,
  upsertPlayer,
  bulkUpsertPlayers,
} from '../../player.repository';

jest.mock('../../player.model');

const mockDoc = (overrides: Partial<IPlayer> = {}): IPlayer => ({
  name: 'Test',
  position: 'FW',
  league: 'Premier League',
  team: 'Arsenal',
  goals: 0,
  assists: 0,
  shots: 0,
  rating: 0,
  keyPasses: 0,
  dribbles: 0,
  tackles: 0,
  minutesPlayed: 0,
  yellowCards: 0,
  redCards: 0,
  ...overrides,
});

describe('player.repository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findPlayers', () => {
    const buildQueryChain = () => {
      const chain: Record<string, jest.Mock> = {
        where: jest.fn(),
        equals: jest.fn(),
        lean: jest.fn(),
        exec: jest.fn(),
      };
      chain.where.mockReturnValue(chain);
      chain.equals.mockReturnValue(chain);
      chain.lean.mockReturnValue(chain);
      return chain;
    };

    it('filters by position with case-insensitive normalization (uppercase)', async () => {
      const q = buildQueryChain();
      q.exec.mockResolvedValue([]);
      (Player.find as jest.Mock).mockReturnValue(q);

      await findPlayers({ position: 'fw' });

      expect(q.where).toHaveBeenCalledWith('position');
      expect(q.equals).toHaveBeenCalledWith('FW');
      expect(Player.find).toHaveBeenCalledWith();
    });

    it('filters by league and team', async () => {
      const q = buildQueryChain();
      q.exec.mockResolvedValue([]);
      (Player.find as jest.Mock).mockReturnValue(q);

      await findPlayers({ league: 'La Liga', team: 'Barcelona' });

      expect(q.where).toHaveBeenCalledWith('league');
      expect(q.equals).toHaveBeenCalledWith('La Liga');
      expect(q.where).toHaveBeenCalledWith('team');
      expect(q.equals).toHaveBeenCalledWith('Barcelona');
    });

    it('returns empty array when no filters match', async () => {
      const q = buildQueryChain();
      q.exec.mockResolvedValue([]);
      (Player.find as jest.Mock).mockReturnValue(q);

      const result = await findPlayers({ league: 'Nonexistent' });
      expect(result).toEqual([]);
      expect(q.where).toHaveBeenCalledWith('league');
    });
  });

  describe('findPlayerById', () => {
    it('returns null for invalid ObjectId', async () => {
      const result = await findPlayerById('not-an-id');
      expect(result).toBeNull();
      expect(Player.findById).not.toHaveBeenCalled();
    });

    it('delegates to Player.findById for valid id', async () => {
      const mockExec = jest.fn().mockResolvedValue(mockDoc());
      (Player.findById as jest.Mock).mockReturnValue({ lean: () => ({ exec: mockExec }) });

      const result = await findPlayerById('507f1f77bcf86cd799439011');
      expect(result).not.toBeNull();
    });
  });

  describe('upsertPlayer', () => {
    it('upserts by externalId when present', async () => {
      const mockExec = jest.fn().mockResolvedValue(mockDoc());
      (Player.findOneAndUpdate as jest.Mock).mockReturnValue({ exec: mockExec });

      await upsertPlayer({ ...mockDoc(), externalId: 'fd:123' });

      const filter = (Player.findOneAndUpdate as jest.Mock).mock.calls[0][0];
      expect(filter.externalId).toBe('fd:123');
    });

    it('upserts by name+team+league when no externalId', async () => {
      const mockExec = jest.fn().mockResolvedValue(mockDoc());
      (Player.findOneAndUpdate as jest.Mock).mockReturnValue({ exec: mockExec });

      await upsertPlayer(mockDoc());

      const filter = (Player.findOneAndUpdate as jest.Mock).mock.calls[0][0];
      expect(filter.name).toBe('Test');
      expect(filter.team).toBe('Arsenal');
      expect(filter.league).toBe('Premier League');
    });
  });

  describe('bulkUpsertPlayers', () => {
    it('returns 0 for empty array', async () => {
      const result = await bulkUpsertPlayers([]);
      expect(result).toBe(0);
      expect(Player.bulkWrite).not.toHaveBeenCalled();
    });

    it('calls bulkWrite with upsert operations', async () => {
      (Player.bulkWrite as jest.Mock).mockResolvedValue({ upsertedCount: 2, modifiedCount: 1 });

      const players = [
        mockDoc({ name: 'A', externalId: 'fd:1' }),
        mockDoc({ name: 'B', externalId: 'fd:2' }),
      ];
      const result = await bulkUpsertPlayers(players);

      expect(Player.bulkWrite).toHaveBeenCalledWith([
        { updateOne: { filter: { externalId: 'fd:1' }, update: { $set: players[0] }, upsert: true } },
        { updateOne: { filter: { externalId: 'fd:2' }, update: { $set: players[1] }, upsert: true } },
      ]);
      expect(result).toBe(3);
    });
  });
});
