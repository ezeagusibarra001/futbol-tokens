import bcrypt from 'bcryptjs';
import { seedSuperuser, seedAll } from '../../seed';
import { User } from '../../../modules/auth/user.model';
import { Player } from '../../../modules/player/player.model';
import { Quote } from '../../../modules/quote/quote.model';
import { recalculateAll } from '../../../modules/quote/quote.service';
import * as marketService from '../../../modules/market/market.service';

jest.mock('../../../modules/auth/user.model');
jest.mock('../../../modules/player/player.model');
jest.mock('../../../modules/quote/quote.model');
jest.mock('../../../modules/quote/quote.service');
jest.mock('../../../modules/market/market.service');
jest.mock('bcryptjs');

const mockFindOne = (value: unknown) => {
  (User.findOne as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(value) });
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SUPERUSER_EMAIL;
  delete process.env.SUPERUSER_PASSWORD;
});

describe('seedSuperuser', () => {
  it('creates a new superuser when none exists', async () => {
    process.env.SUPERUSER_PASSWORD = 'test-pw';
    mockFindOne(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw');
    (User.create as jest.Mock).mockResolvedValue(undefined);

    await seedSuperuser();

    expect(User.findOne).toHaveBeenCalledWith({ email: 'superuser@futbol-tokens.local' });
    expect(bcrypt.hash).toHaveBeenCalledWith('test-pw', 10);
    expect(User.create).toHaveBeenCalledWith({ email: 'superuser@futbol-tokens.local', password: 'hashed_pw', isSuperuser: true });
  });

  it('throws when SUPERUSER_PASSWORD is missing', async () => {
    mockFindOne(null);
    await expect(seedSuperuser()).rejects.toThrow('SUPERUSER_PASSWORD environment variable is required');
  });

  it('upgrades existing user to superuser if not already', async () => {
    process.env.SUPERUSER_PASSWORD = 'pw';
    const mockSave = jest.fn().mockResolvedValue(undefined);
    const existing = { email: 'super@test.com', isSuperuser: false, save: mockSave };
    mockFindOne(existing);

    await seedSuperuser();

    expect(existing.isSuperuser).toBe(true);
    expect(mockSave).toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it('skips if superuser already exists', async () => {
    process.env.SUPERUSER_PASSWORD = 'pw';
    const existing = { email: 'super@test.com', isSuperuser: true, save: jest.fn() };
    mockFindOne(existing);

    await seedSuperuser();

    expect(existing.save).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it('uses env vars when provided', async () => {
    process.env.SUPERUSER_EMAIL = 'admin@test.com';
    process.env.SUPERUSER_PASSWORD = 'admin123';
    mockFindOne(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    (User.create as jest.Mock).mockResolvedValue(undefined);

    await seedSuperuser();

    expect(User.findOne).toHaveBeenCalledWith({ email: 'admin@test.com' });
    expect(bcrypt.hash).toHaveBeenCalledWith('admin123', 10);
  });
});

describe('seedAll', () => {
  it('calls seedSuperuser and all seed helpers', async () => {
    process.env.SUPERUSER_PASSWORD = 'pw';
    mockFindOne(null);
    (Player.countDocuments as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
    (Player.insertMany as jest.Mock).mockResolvedValue([]);
    (Quote.countDocuments as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
    (recalculateAll as jest.Mock).mockResolvedValue({ strategy: 'PW', version: '1', quotesCreated: 5, at: new Date() });
    (bcrypt.hash as jest.Mock).mockResolvedValue('h');
    (User.create as jest.Mock).mockResolvedValue(undefined);
    (marketService.ensureInitialHoldingsForAllPlayers as jest.Mock).mockResolvedValue(5);

    await seedAll();

    expect(User.findOne).toHaveBeenCalled();
    expect(Player.countDocuments).toHaveBeenCalled();
    expect(Player.insertMany).toHaveBeenCalled();
    expect(Quote.countDocuments).toHaveBeenCalled();
    expect(recalculateAll).toHaveBeenCalled();
    expect(marketService.ensureInitialHoldingsForAllPlayers).toHaveBeenCalled();
  });

  it('skips demo players if they already exist', async () => {
    process.env.SUPERUSER_PASSWORD = 'pw';
    mockFindOne(null);
    (Player.countDocuments as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(3) });
    (Quote.countDocuments as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
    (recalculateAll as jest.Mock).mockResolvedValue({ strategy: 'PW', version: '1', quotesCreated: 5, at: new Date() });
    (bcrypt.hash as jest.Mock).mockResolvedValue('h');
    (User.create as jest.Mock).mockResolvedValue(undefined);
    (marketService.ensureInitialHoldingsForAllPlayers as jest.Mock).mockResolvedValue(5);

    await seedAll();

    expect(Player.insertMany).not.toHaveBeenCalled();
  });

  it('skips demo quotes if they already exist', async () => {
    process.env.SUPERUSER_PASSWORD = 'pw';
    mockFindOne(null);
    (Player.countDocuments as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
    (Player.insertMany as jest.Mock).mockResolvedValue([]);
    (Quote.countDocuments as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(10) });
    (bcrypt.hash as jest.Mock).mockResolvedValue('h');
    (User.create as jest.Mock).mockResolvedValue(undefined);
    (marketService.ensureInitialHoldingsForAllPlayers as jest.Mock).mockResolvedValue(5);

    await seedAll();

    expect(recalculateAll).not.toHaveBeenCalled();
  });
});
