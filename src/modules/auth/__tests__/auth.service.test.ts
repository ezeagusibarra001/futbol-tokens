import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { register, login, refresh, logout } from '../auth.service';
import { User } from '../user.model';

jest.mock('../user.model');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockUser = {
  id: 'user123',
  email: 'test@example.com',
  password: 'hashed_password',
  refreshToken: null as string | null,
  save: jest.fn().mockResolvedValue(undefined),
};

const ACCESS_SECRET = 'access_secret';
const REFRESH_SECRET = 'refresh_secret';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_ACCESS_SECRET = ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
});

describe('auth.service - register', () => {
  it('should register a new user and return tokens', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
    (User.create as jest.Mock).mockResolvedValue({ ...mockUser });
    (jwt.sign as jest.Mock).mockReturnValueOnce('access_token').mockReturnValueOnce('refresh_token');

    const result = await register('test@example.com', 'password123');

    expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    expect(result).toEqual({ accessToken: 'access_token', refreshToken: 'refresh_token' });
  });

  it('should throw 409 if email is already in use', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(mockUser);

    await expect(register('test@example.com', 'password123')).rejects.toMatchObject({
      message: 'Email already in use',
      status: 409,
    });
  });
});

describe('auth.service - login', () => {
  it('should return tokens on valid credentials', async () => {
    (User.findOne as jest.Mock).mockResolvedValue({ ...mockUser });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValueOnce('access_token').mockReturnValueOnce('refresh_token');

    const result = await login('test@example.com', 'password123');

    expect(result).toEqual({ accessToken: 'access_token', refreshToken: 'refresh_token' });
  });

  it('should throw 401 if user not found', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);

    await expect(login('no@example.com', 'password123')).rejects.toMatchObject({
      message: 'Invalid credentials',
      status: 401,
    });
  });

  it('should throw 401 if password is wrong', async () => {
    (User.findOne as jest.Mock).mockResolvedValue({ ...mockUser });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(login('test@example.com', 'wrongpass')).rejects.toMatchObject({
      message: 'Invalid credentials',
      status: 401,
    });
  });
});

describe('auth.service - refresh', () => {
  it('should return new tokens when refresh token is valid', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 'user123' });
    (User.findById as jest.Mock).mockResolvedValue({ ...mockUser, refreshToken: 'valid_refresh_token' });
    (jwt.sign as jest.Mock).mockReturnValueOnce('new_access_token').mockReturnValueOnce('new_refresh_token');

    const result = await refresh('valid_refresh_token');

    expect(result).toEqual({ accessToken: 'new_access_token', refreshToken: 'new_refresh_token' });
  });

  it('should throw 401 if refresh token is invalid', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('invalid'); });

    await expect(refresh('bad_token')).rejects.toMatchObject({ status: 401 });
  });

  it('should throw 401 if stored token does not match', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 'user123' });
    (User.findById as jest.Mock).mockResolvedValue({ ...mockUser, refreshToken: 'different_token' });

    await expect(refresh('some_token')).rejects.toMatchObject({
      message: 'Refresh token revoked',
      status: 401,
    });
  });
});

describe('auth.service - logout', () => {
  it('should revoke refresh token on logout', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 'user123' });
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(undefined);

    await expect(logout('valid_refresh_token')).resolves.toBeUndefined();
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', { refreshToken: null });
  });

  it('should throw 401 if refresh token is invalid on logout', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('invalid'); });

    await expect(logout('bad_token')).rejects.toMatchObject({ status: 401 });
  });
});
