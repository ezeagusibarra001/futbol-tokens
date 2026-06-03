import request from 'supertest';
import { Types } from 'mongoose';
import {
  startTestDb, stopTestDb, getApp, clearDb,
  createSuperuser, registerAndGetToken, createTestPlayer, createInitialHolding,
} from '../../../__tests__/helpers';

jest.setTimeout(120000);

let auth: { userId: string; accessToken: string; refreshToken: string };
let player1Id: string;
let player2Id: string;

beforeAll(async () => {
  await startTestDb();
}, 120000);

afterAll(async () => {
  await stopTestDb();
}, 30000);

beforeEach(async () => {
  await clearDb();

  const suId = await createSuperuser();
  auth = await registerAndGetToken();

  const p1 = await createTestPlayer({ name: 'Lionel Messi', position: 'FW', team: 'PSG', league: 'Ligue 1', goals: 20, assists: 15, rating: 8.5 });
  const p2 = await createTestPlayer({ name: 'Kylian Mbappe', position: 'FW', team: 'PSG', league: 'Ligue 1', goals: 25, assists: 8, rating: 8.0 });
  player1Id = p1._id.toString();
  player2Id = p2._id.toString();

  await createInitialHolding(suId, p1._id, 100);
  await createInitialHolding(suId, p2._id, 100);
});

const recalculateAndBuy = async (playerId: string, tokens: number) => {
  await request(getApp())
    .post('/quotes/recalculate')
    .set('Authorization', `Bearer ${auth.accessToken}`)
    .send({})
    .expect(200);

  return request(getApp())
    .post('/orders/buy')
    .set('Authorization', `Bearer ${auth.accessToken}`)
    .send({ playerId, tokens })
    .expect(201);
};

describe('GET /users/:id/portfolio', () => {
  beforeEach(async () => {
    await recalculateAndBuy(player1Id, 5);
  });

  it('returns portfolio with positions (200)', async () => {
    const res = await request(getApp())
      .get(`/users/${auth.userId}/portfolio`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('positions');
    expect(res.body).toHaveProperty('totals');
    expect(res.body.positions).toHaveLength(1);
    expect(res.body.positions[0]).toHaveProperty('playerName', 'Lionel Messi');
    expect(res.body.positions[0].tokens).toBe(5);
    expect(res.body.positions[0]).toHaveProperty('currentValue');
    expect(res.body.positions[0].currentValue).toBeGreaterThan(0);
    expect(res.body.totals.invested).toBeGreaterThan(0);
    expect(res.body.totals.currentValue).toBeGreaterThan(0);
  });

  it('rejects cross-user access (403)', async () => {
    const otherId = new Types.ObjectId().toString();
    const res = await request(getApp())
      .get(`/users/${otherId}/portfolio`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(403);

    expect(res.body.message).toBe('You can only access your own portfolio');
  });

  it('returns empty portfolio for user with no holdings', async () => {
    const freshAuth = await registerAndGetToken('noholdings@test.com', 'password');
    const res = await request(getApp())
      .get(`/users/${freshAuth.userId}/portfolio`)
      .set('Authorization', `Bearer ${freshAuth.accessToken}`)
      .expect(200);

    expect(res.body.positions).toEqual([]);
    expect(res.body.totals.invested).toBe(0);
  });

  it('shows multiple positions after buying two different players', async () => {
    await recalculateAndBuy(player2Id, 3);

    const res = await request(getApp())
      .get(`/users/${auth.userId}/portfolio`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.positions).toHaveLength(2);
    expect(res.body.totals.invested).toBeGreaterThan(0);
  });

  it('pnl reflects price changes after recalculation', async () => {
    await request(getApp())
      .post('/quotes/recalculate')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ strategy: 'PositionAware' })
      .expect(200);

    const res = await request(getApp())
      .get(`/users/${auth.userId}/portfolio`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.positions[0]).toHaveProperty('pnl');
    expect(res.body.positions[0]).toHaveProperty('pnlPct');
    expect(res.body.positions[0].currentValue).toBeGreaterThan(0);
    expect(res.body.totals.currentValue).toBeGreaterThan(0);
  });
});

describe('GET /users/:id/transactions', () => {
  beforeEach(async () => {
    await recalculateAndBuy(player1Id, 3);
  });

  it('returns transaction history (200)', async () => {
    const res = await request(getApp())
      .get(`/users/${auth.userId}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].side).toBe('BUY');
    expect(res.body[0].tokens).toBe(3);
  });

  it('rejects cross-user access (403)', async () => {
    const otherId = new Types.ObjectId().toString();
    const res = await request(getApp())
      .get(`/users/${otherId}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(403);

    expect(res.body.message).toBe('You can only access your own transactions');
  });

  it('returns empty array for user with no transactions', async () => {
    const freshAuth = await registerAndGetToken('notx@test.com', 'password');
    const res = await request(getApp())
      .get(`/users/${freshAuth.userId}/transactions`)
      .set('Authorization', `Bearer ${freshAuth.accessToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('returns empty array for user with no transactions', async () => {
    const freshAuth = await registerAndGetToken('notx@test.com', 'password');
    const res = await request(getApp())
      .get(`/users/${freshAuth.userId}/transactions`)
      .set('Authorization', `Bearer ${freshAuth.accessToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });
});

describe('GET /users/:id/transactions — buy + sell mix', () => {
  beforeEach(async () => {
    await clearDb();

    const suId = await createSuperuser();
    auth = await registerAndGetToken();

    const p1 = await createTestPlayer({ name: 'Lionel Messi', position: 'FW', team: 'PSG', league: 'Ligue 1', goals: 20, assists: 15, rating: 8.5 });
    player1Id = p1._id.toString();

    await createInitialHolding(suId, p1._id, 100);

    await recalculateAndBuy(player1Id, 10);

    await request(getApp())
      .post('/orders/sell')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: player1Id, tokens: 3 })
      .expect(201);
  });

  it('returns both buy and sell orders in history', async () => {
    const res = await request(getApp())
      .get(`/users/${auth.userId}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    const sides = res.body.map((o: { side: string }) => o.side);
    expect(sides).toContain('BUY');
    expect(sides).toContain('SELL');
  });

  it('transactions are sorted by createdAt descending', async () => {
    const res = await request(getApp())
      .get(`/users/${auth.userId}/transactions`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    const dates = res.body.map((o: { createdAt: string }) => new Date(o.createdAt).getTime());
    expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
  });
});
