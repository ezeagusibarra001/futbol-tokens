import request from 'supertest';
import { Types } from 'mongoose';
import {
  startTestDb,
  stopTestDb,
  getApp,
  clearDb,
  createSuperuser,
  createTestPlayer,
  createInitialHolding,
  registerAndGetToken,
} from '../../../__tests__/helpers';

jest.setTimeout(120000);

let auth: { userId: string; accessToken: string; refreshToken: string };
let player1Id: string;
let suId: Types.ObjectId;

beforeAll(async () => {
  await startTestDb();
}, 120000);

afterAll(async () => {
  await stopTestDb();
}, 30000);

beforeEach(async () => {
  await clearDb();

  suId = await createSuperuser();
  auth = await registerAndGetToken();

  const p1 = await createTestPlayer({ name: 'Lionel Messi', position: 'FW', team: 'PSG', league: 'Ligue 1', goals: 20, assists: 15, rating: 8.5 });
  const p2 = await createTestPlayer({ name: 'Kylian Mbappe', position: 'FW', team: 'PSG', league: 'Ligue 1', goals: 25, assists: 8, rating: 8.0 });
  player1Id = p1._id.toString();

  await createInitialHolding(suId, p1._id, 100);
  await createInitialHolding(suId, p2._id, 100);
});

describe('POST /orders/buy', () => {
  beforeEach(async () => {
    await request(getApp())
      .post('/quotes/recalculate')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({})
      .expect(200);
  });

  it('buys tokens successfully (201)', async () => {
    const res = await request(getApp())
      .post('/orders/buy')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: player1Id, tokens: 5 })
      .expect(201);

    expect(res.body.source).toBe('superuser');
    expect(res.body.order).toHaveProperty('_id');
    expect(res.body.order.side).toBe('BUY');
    expect(res.body.order.tokens).toBe(5);
    expect(res.body.order).toHaveProperty('total');
    expect(res.body.order.total).toBeGreaterThan(0);
  });

  it('rejects invalid playerId (400)', async () => {
    const res = await request(getApp())
      .post('/orders/buy')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: 'not-an-object-id', tokens: 5 })
      .expect(400);

    expect(res.body.message).toBe('Invalid playerId');
  });

  it('rejects non-positive tokens (400)', async () => {
    const res = await request(getApp())
      .post('/orders/buy')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: player1Id, tokens: 0 })
      .expect(400);

    expect(res.body.message).toBe('tokens must be a positive integer');
  });

  it('returns 409 when not enough tokens available', async () => {
    const res = await request(getApp())
      .post('/orders/buy')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: player1Id, tokens: 999 })
      .expect(409);

    expect(res.body.message).toBe('Not enough tokens available from superuser');
  });

  it('is idempotent with Idempotency-Key header', async () => {
    const idemKey = 'idem-buy-001';
    const first = await request(getApp())
      .post('/orders/buy')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Idempotency-Key', idemKey)
      .send({ playerId: player1Id, tokens: 3 })
      .expect(201);

    const second = await request(getApp())
      .post('/orders/buy')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Idempotency-Key', idemKey)
      .send({ playerId: player1Id, tokens: 3 })
      .expect(201);

    expect(second.body._id).toBe(first.body._id);
  });

  it('returns 404 for non-existent playerId (valid ObjectId)', async () => {
    const fakeId = new Types.ObjectId().toString();
    const res = await request(getApp())
      .post('/orders/buy')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: fakeId, tokens: 1 })
      .expect(404);

    expect(res.body.message).toBe('Player not found');
  });

  it('multiple buys of same player update avgBuyPrice', async () => {
    await request(getApp())
      .post('/orders/buy')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: player1Id, tokens: 5 })
      .expect(201);

    await request(getApp())
      .post('/orders/buy')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: player1Id, tokens: 5 })
      .expect(201);

    const port = await request(getApp())
      .get(`/users/${auth.userId}/portfolio`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const pos = port.body.positions[0];
    expect(pos.tokens).toBe(10);
    expect(pos.avgBuyPrice).toBeGreaterThan(0);
  });
});

describe('POST /orders/sell', () => {
  beforeEach(async () => {
    await request(getApp())
      .post('/quotes/recalculate')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({})
      .expect(200);

    await request(getApp())
      .post('/orders/buy')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: player1Id, tokens: 10 })
      .expect(201);
  });

  it('sells tokens successfully (201)', async () => {
    const res = await request(getApp())
      .post('/orders/sell')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: player1Id, tokens: 4 })
      .expect(201);

    expect(res.body.side).toBe('SELL');
    expect(res.body.tokens).toBe(4);
  });

  it('returns 409 when selling more than owned', async () => {
    const res = await request(getApp())
      .post('/orders/sell')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ playerId: player1Id, tokens: 999 })
      .expect(409);

    expect(res.body.message).toBe('Insufficient token balance to create sell post');
  });

  it('returns 409 when selling without any holdings', async () => {
    const fresh = await registerAndGetToken('nobuy@test.com', 'password');
    const res = await request(getApp())
      .post('/orders/sell')
      .set('Authorization', `Bearer ${fresh.accessToken}`)
      .send({ playerId: player1Id, tokens: 1 })
      .expect(409);

    expect(res.body.message).toBe('Insufficient token balance to create sell post');
  });

  it('creates a new sell post each time (idempotency-key not used for sell)', async () => {
    const idemKey = 'idem-sell-001';
    const first = await request(getApp())
      .post('/orders/sell')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Idempotency-Key', idemKey)
      .send({ playerId: player1Id, tokens: 2 })
      .expect(201);

    const second = await request(getApp())
      .post('/orders/sell')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Idempotency-Key', idemKey)
      .send({ playerId: player1Id, tokens: 2 })
      .expect(201);

    expect(second.body._id).not.toBe(first.body._id);
  });
});
