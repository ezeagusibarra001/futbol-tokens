import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import app from '../../app';
import { User } from '../auth/user.model';
import { Player } from '../player/player.model';
import { Holding } from '../market/holding.model';

let mongoServer: MongoMemoryReplSet;

export const TEST_USER_EMAIL = 'testuser@test.com';
export const TEST_USER_PASSWORD = 'password123';

export const startTestDb = async (): Promise<void> => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: 'wiredTiger',
    },
  });

  const uri = mongoServer.getUri();

  process.env.MONGO_URI = uri;
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-e2e';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-e2e';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
  process.env.LOG_LEVEL = 'silent';
  process.env.SUPERUSER_EMAIL = 'superuser@futbol-tokens.local';
  process.env.SUPERUSER_PASSWORD = 'change-me-now';

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 120000,
  });
};

export const stopTestDb = async (): Promise<void> => {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
  }
};

export const getApp = () => app;

export const clearDb = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 1) return;
  const db = mongoose.connection.db;
  if (db) {
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      await db.dropCollection(collection.name);
    }
  }
};

export const createSuperuser = async (): Promise<Types.ObjectId> => {
  const bcrypt = await import('bcryptjs');
  const hashed = await bcrypt.hash('change-me-now', 10);
  const user = await User.create({
    email: 'superuser@futbol-tokens.local',
    password: hashed,
    isSuperuser: true,
  });
  return user._id as Types.ObjectId;
};

export const registerAndGetToken = async (email?: string, password?: string): Promise<{ userId: string; accessToken: string; refreshToken: string }> => {
  const supertest = (await import('supertest')).default;
  const em = email ?? TEST_USER_EMAIL;
  const pw = password ?? TEST_USER_PASSWORD;
  const existing = await User.findOne({ email: em }).exec();
  if (existing) {
    const res = await supertest(app)
      .post('/auth/login')
      .send({ email: em, password: pw })
      .expect(200);
    return {
      userId: (existing._id as Types.ObjectId).toString(),
      accessToken: res.body.accessToken,
      refreshToken: res.body.refreshToken,
    };
  }
  const res = await supertest(app)
    .post('/auth/register')
    .send({ email: em, password: pw })
    .expect(201);
  const user = await User.findOne({ email: em }).exec();
  return {
    userId: (user!._id as Types.ObjectId).toString(),
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
};

export const createTestPlayer = async (overrides: Record<string, unknown> = {}): Promise<{ _id: Types.ObjectId }> => {
  const defaultPlayer = {
    name: 'Test Player',
    position: 'FW',
    league: 'Premier League',
    team: 'Test FC',
    goals: 10,
    assists: 5,
    shots: 20,
    rating: 7.5,
    keyPasses: 15,
    dribbles: 10,
    tackles: 5,
    minutesPlayed: 900,
    yellowCards: 2,
    redCards: 0,
  };
  const player = await Player.create({ ...defaultPlayer, ...overrides });
  return { _id: player._id as Types.ObjectId };
};

export const createInitialHolding = async (
  userId: Types.ObjectId,
  playerId: Types.ObjectId,
  tokens = 100
): Promise<void> => {
  await Holding.create({ userId, playerId, tokens, avgBuyPrice: 0 });
};
