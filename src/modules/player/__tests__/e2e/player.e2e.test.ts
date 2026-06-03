import request from 'supertest';
import { Types } from 'mongoose';
import { startTestDb, stopTestDb, getApp, clearDb, registerAndGetToken, createTestPlayer } from '../../../__tests__/helpers';

jest.setTimeout(120000);

let auth: { userId: string; accessToken: string; refreshToken: string };
let player1Id: string;

beforeAll(async () => {
  await startTestDb();
}, 120000);

afterAll(async () => {
  await stopTestDb();
}, 30000);

beforeEach(async () => {
  await clearDb();

  auth = await registerAndGetToken();

  const p1 = await createTestPlayer({ name: 'Lionel Messi', position: 'FW', team: 'PSG', league: 'Ligue 1', goals: 20, assists: 15, rating: 8.5 });
  await createTestPlayer({ name: 'Kylian Mbappe', position: 'FW', team: 'PSG', league: 'Ligue 1', goals: 25, assists: 8, rating: 8.0 });
  await createTestPlayer({ name: 'Virgil van Dijk', position: 'DF', team: 'Liverpool', league: 'Premier League', goals: 5, assists: 2, rating: 7.8 });
  player1Id = p1._id.toString();
});

describe('GET /players — authorization', () => {
  it('rejects without auth header (401)', async () => {
    const res = await request(getApp())
      .get('/players')
      .expect(401);
    expect(res.body.message).toBe('Missing or invalid Authorization header');
  });

  it('rejects with invalid token (401)', async () => {
    const res = await request(getApp())
      .get('/players')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
    expect(res.body.message).toBe('Invalid or expired access token');
  });

  it('returns player list with valid token (200)', async () => {
    const res = await request(getApp())
      .get('/players')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('position');
    expect(res.body[0]).toHaveProperty('league');
    expect(res.body[0]).toHaveProperty('team');
  });
});

describe('GET /players — filters', () => {
  it('filters by league', async () => {
    const res = await request(getApp())
      .get('/players?league=Ligue%201')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body.every((p: { league: string }) => p.league === 'Ligue 1')).toBe(true);
  });

  it('returns empty array for non-matching league', async () => {
    const res = await request(getApp())
      .get('/players?league=Serie%20A')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('filters by position', async () => {
    const res = await request(getApp())
      .get('/players?position=FW')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
  });

  it('filters by team and position combination', async () => {
    const res = await request(getApp())
      .get('/players?team=PSG&position=FW')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
  });

  it('filters by team only', async () => {
    const res = await request(getApp())
      .get('/players?team=Liverpool')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Virgil van Dijk');
  });
});

describe('GET /players/:id', () => {
  it('returns a player by id (200)', async () => {
    const res = await request(getApp())
      .get(`/players/${player1Id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body.name).toBe('Lionel Messi');
    expect(res.body.league).toBe('Ligue 1');
    expect(res.body.team).toBe('PSG');
    expect(res.body.position).toBe('FW');
  });

  it('returns 404 for non-existent id', async () => {
    const fakeId = new Types.ObjectId().toString();
    const res = await request(getApp())
      .get(`/players/${fakeId}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(404);

    expect(res.body.message).toBe('Player not found');
  });
});

describe('POST /players/sync', () => {
  it('rejects missing league (400)', async () => {
    const res = await request(getApp())
      .post('/players/sync')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({})
      .expect(400);

    expect(res.body.message).toBe('league is required');
  });

  it('rejects missing league even with team (400)', async () => {
    const res = await request(getApp())
      .post('/players/sync')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ team: 'PSG' })
      .expect(400);

    expect(res.body.message).toBe('league is required');
  });

  it('rejects without auth (401)', async () => {
    await request(getApp())
      .post('/players/sync')
      .send({ league: 'Premier League' })
      .expect(401);
  });
});
