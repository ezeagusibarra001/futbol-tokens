import request from 'supertest';
import { startTestDb, stopTestDb, getApp, clearDb } from '../../../__tests__/helpers';

jest.setTimeout(120000);

beforeAll(async () => {
  await startTestDb();
}, 120000);

afterAll(async () => {
  await stopTestDb();
}, 30000);

beforeEach(async () => {
  await clearDb();
});

describe('POST /auth/register', () => {
  it('registers a new user and returns tokens (201)', async () => {
    const res = await request(getApp())
      .post('/auth/register')
      .send({ email: 'alice@test.com', password: 'secret123' })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('rejects duplicate email (409)', async () => {
    await request(getApp())
      .post('/auth/register')
      .send({ email: 'dup@test.com', password: 'secret123' })
      .expect(201);

    const res = await request(getApp())
      .post('/auth/register')
      .send({ email: 'dup@test.com', password: 'other456' })
      .expect(409);

    expect(res.body.message).toBe('Email already in use');
  });

  it('rejects missing fields (400)', async () => {
    const res = await request(getApp())
      .post('/auth/register')
      .send({ email: 'only@test.com' })
      .expect(400);

    expect(res.body.message).toBeDefined();
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(getApp())
      .post('/auth/register')
      .send({ email: 'bob@test.com', password: 'mypassword' })
      .expect(201);
  });

  it('logs in with valid credentials (200)', async () => {
    const res = await request(getApp())
      .post('/auth/login')
      .send({ email: 'bob@test.com', password: 'mypassword' })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('rejects wrong password (401)', async () => {
    const res = await request(getApp())
      .post('/auth/login')
      .send({ email: 'bob@test.com', password: 'wrongpass' })
      .expect(401);

    expect(res.body.message).toBe('Invalid credentials');
  });

  it('rejects non-existent email (401)', async () => {
    const res = await request(getApp())
      .post('/auth/login')
      .send({ email: 'nobody@test.com', password: 'irrelevant' })
      .expect(401);

    expect(res.body.message).toBe('Invalid credentials');
  });
});

describe('POST /auth/refresh', () => {
  let refreshToken: string;

  beforeEach(async () => {
    const res = await request(getApp())
      .post('/auth/register')
      .send({ email: 'refresh@test.com', password: 'password' })
      .expect(201);
    refreshToken = res.body.refreshToken;
  });

  it('returns new tokens with valid refresh token (200)', async () => {
    const res = await request(getApp())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('rejects invalid refresh token (401)', async () => {
    const res = await request(getApp())
      .post('/auth/refresh')
      .send({ refreshToken: 'garbage-token' })
      .expect(401);

    expect(res.body.message).toBe('Invalid or expired refresh token');
  });

  it('rejects missing refreshToken (400)', async () => {
    const res = await request(getApp())
      .post('/auth/refresh')
      .send({})
      .expect(400);

    expect(res.body.message).toBe('refreshToken is required');
  });
});

describe('POST /auth/logout', () => {
  let refreshToken: string;

  beforeEach(async () => {
    const res = await request(getApp())
      .post('/auth/register')
      .send({ email: 'logout@test.com', password: 'password' })
      .expect(201);
    refreshToken = res.body.refreshToken;
  });

  it('logs out successfully (204)', async () => {
    await request(getApp())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(204);
  });

  it('refresh token is revoked after logout (401)', async () => {
    await request(getApp())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(204);

    const res = await request(getApp())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    expect(res.body.message).toBe('Refresh token revoked');
  });

  it('rejects missing refreshToken (400)', async () => {
    const res = await request(getApp())
      .post('/auth/logout')
      .send({})
      .expect(400);

    expect(res.body.message).toBe('refreshToken is required');
  });
});

describe('POST /auth/refresh — token rotation', () => {
  let firstRefreshToken: string;

  beforeEach(async () => {
    const reg = await request(getApp())
      .post('/auth/register')
      .send({ email: 'rotation@test.com', password: 'password' })
      .expect(201);
    firstRefreshToken = reg.body.refreshToken;
  });

  it('old refresh token is invalid after a new refresh', async () => {
    await new Promise(r => setTimeout(r, 1500));

    const refreshRes = await request(getApp())
      .post('/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(200);

    expect(refreshRes.body).toHaveProperty('refreshToken');

    const retry = await request(getApp())
      .post('/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(401);

    expect(retry.body.message).toBe('Refresh token revoked');
  });
});
