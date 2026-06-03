import bcrypt from 'bcryptjs';
import { seedSuperuser, seedAll } from '../../seed';
import { User } from '../../../modules/auth/user.model';
import * as marketService from '../../../modules/market/market.service';

jest.mock('../../../modules/auth/user.model');
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
    mockFindOne(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw');
    (User.create as jest.Mock).mockResolvedValue(undefined);

    await seedSuperuser();

    expect(User.findOne).toHaveBeenCalledWith({ email: 'superuser@futbol-tokens.local' });
    expect(bcrypt.hash).toHaveBeenCalledWith('change-me-now', 10);
    expect(User.create).toHaveBeenCalledWith({ email: 'superuser@futbol-tokens.local', password: 'hashed_pw', isSuperuser: true });
  });

  it('upgrades existing user to superuser if not already', async () => {
    const mockSave = jest.fn().mockResolvedValue(undefined);
    const existing = { email: 'super@test.com', isSuperuser: false, save: mockSave };
    mockFindOne(existing);

    await seedSuperuser();

    expect(existing.isSuperuser).toBe(true);
    expect(mockSave).toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it('skips if superuser already exists', async () => {
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
  it('calls seedSuperuser and ensureInitialHoldingsForAllPlayers', async () => {
    mockFindOne(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('h');
    (User.create as jest.Mock).mockResolvedValue(undefined);
    (marketService.ensureInitialHoldingsForAllPlayers as jest.Mock).mockResolvedValue(5);

    await seedAll();

    expect(User.findOne).toHaveBeenCalled();
    expect(marketService.ensureInitialHoldingsForAllPlayers).toHaveBeenCalled();
  });
});
