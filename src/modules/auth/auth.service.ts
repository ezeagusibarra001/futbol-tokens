import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from './user.model';

const SALT_ROUNDS = 10;

const getSecret = (key: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string => {
  const secret = process.env[key];
  if (!secret) throw new Error(`${key} is not defined in environment variables`);
  return secret;
};

const signAccessToken = (userId: string): string =>
  jwt.sign({ sub: userId }, getSecret('JWT_ACCESS_SECRET'), {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  } as jwt.SignOptions);

const signRefreshToken = (userId: string): string =>
  jwt.sign({ sub: userId }, getSecret('JWT_REFRESH_SECRET'), {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  } as jwt.SignOptions);

export const register = async (email: string, password: string) => {
  const safeEmail = String(email);
  const existing = await User.findOne({ email: safeEmail });
  if (existing) throw Object.assign(new Error('Email already in use'), { status: 409 });

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ email: safeEmail, password: hashed });

  const accessToken = signAccessToken(user.id as string);
  const refreshToken = signRefreshToken(user.id as string);

  user.refreshToken = refreshToken;
  await user.save();

  return { accessToken, refreshToken };
};

export const login = async (email: string, password: string) => {
  const safeEmail = String(email);
  const user = await User.findOne({ email: safeEmail });
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const accessToken = signAccessToken(user.id as string);
  const refreshToken = signRefreshToken(user.id as string);

  user.refreshToken = refreshToken;
  await user.save();

  return { accessToken, refreshToken };
};

export const refresh = async (token: string) => {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, getSecret('JWT_REFRESH_SECRET')) as jwt.JwtPayload;
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }

  const user = await User.findById(payload.sub);
  if (!user || user.refreshToken !== token) {
    throw Object.assign(new Error('Refresh token revoked'), { status: 401 });
  }

  const accessToken = signAccessToken(user.id as string);
  const newRefreshToken = signRefreshToken(user.id as string);

  user.refreshToken = newRefreshToken;
  await user.save();

  return { accessToken, refreshToken: newRefreshToken };
};

export const logout = async (token: string) => {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, getSecret('JWT_REFRESH_SECRET')) as jwt.JwtPayload;
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }

  await User.findByIdAndUpdate(payload.sub, { refreshToken: null });
};
