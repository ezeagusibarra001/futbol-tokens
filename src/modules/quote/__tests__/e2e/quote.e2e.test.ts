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

describe('POST /quotes/recalculate', () => {
  it('recalculates quotes with default strategy (200)', async () => {
    const res = await request(getApp())
      .post('/quotes/recalculate')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({})
      .expect(200);

    expect(res.body).toHaveProperty('strategy', 'PerformanceWeighted');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('quotesCreated');
    expect(res.body.quotesCreated).toBe(2);
    expect(res.body).toHaveProperty('at');
  });

  it('recalculates with PositionAware strategy (200)', async () => {
    const res = await request(getApp())
      .post('/quotes/recalculate')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ strategy: 'PositionAware' })
      .expect(200);

    expect(res.body.strategy).toBe('PositionAware');
    expect(res.body.quotesCreated).toBe(2);
  });

  it('returns 200 with 0 quotes when no players exist', async () => {
    await clearDb();
    const freshAuth = await registerAndGetToken('empty@test.com', 'password');

    const res = await request(getApp())
      .post('/quotes/recalculate')
      .set('Authorization', `Bearer ${freshAuth.accessToken}`)
      .send({})
      .expect(200);

    expect(res.body.quotesCreated).toBe(0);
  });
});

describe('GET /players/ranking', () => {
  beforeEach(async () => {
    await request(getApp())
      .post('/quotes/recalculate')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({})
      .expect(200);
  });

  it('returns ranking sorted by value descending', async () => {
    const res = await request(getApp())
      .get('/players/ranking')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('player');
    expect(res.body[0]).toHaveProperty('quote');
    expect(res.body[0].quote).not.toBeNull();
    expect(res.body[0].quote.value).toBeGreaterThanOrEqual(res.body[1].quote.value);
  });

  it('respects limit param', async () => {
    const res = await request(getApp())
      .get('/players/ranking?limit=1')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
  });

  it('clamps limit=0 to default and returns all', async () => {
    const res = await request(getApp())
      .get('/players/ranking?limit=0')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /players/:id/quotes', () => {
  beforeEach(async () => {
    await request(getApp())
      .post('/quotes/recalculate')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({})
      .expect(200);
  });

  it('returns quote history for a player', async () => {
    const res = await request(getApp())
      .get(`/players/${player1Id}/quotes`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('value');
    expect(res.body[0]).toHaveProperty('playerId', player1Id);
    expect(res.body[0]).toHaveProperty('score');
    expect(res.body[0]).toHaveProperty('strategyName');
  });

  it('returns empty array for player with no quotes', async () => {
    const newPlayer = await createTestPlayer({ name: 'New Player', team: 'New Team' });
    const res = await request(getApp())
      .get(`/players/${newPlayer._id}/quotes`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('supports from/to date filters', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();

    const res = await request(getApp())
      .get(`/players/${player1Id}/quotes?from=${past}&to=${future}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});
