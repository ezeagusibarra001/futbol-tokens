import { Response } from 'express';
import { buyHandler, createSellPostHandler, cancelSellPostHandler, getSellPostsHandler } from '../../order.controller';
import * as service from '../../order.service';
import { AuthRequest } from '../../../auth/auth.middleware';

jest.mock('../../order.service');

const mkRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

beforeEach(() => jest.clearAllMocks());

describe('order.controller', () => {
  it('buy returns 401 when unauthenticated', async () => {
    const req = { header: () => undefined, body: {} } as unknown as AuthRequest;
    const res = mkRes();
    await buyHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('buy returns 400 when missing playerId or tokens', async () => {
    const req = { userId: 'u', header: () => undefined, body: { playerId: 'p' } } as unknown as AuthRequest;
    const res = mkRes();
    await buyHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('buy delegates with idempotency key from header', async () => {
    (service.buy as jest.Mock).mockResolvedValue({ source: 'superuser', order: { _id: 'o' } });
    const req = {
      userId: 'u',
      header: jest.fn().mockReturnValue('idem-1'),
      body: { playerId: 'p', tokens: 3 },
    } as unknown as AuthRequest;
    const res = mkRes();
    await buyHandler(req, res, jest.fn());
    expect(service.buy).toHaveBeenCalledWith('u', 'p', 3, 'idem-1', undefined);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sell (createSellPost) returns 201 with order', async () => {
    (service.createSellPost as jest.Mock).mockResolvedValue({ _id: 'o1', side: 'SELL', status: 'ACTIVE' });
    const req = {
      userId: 'u',
      header: () => undefined,
      body: { playerId: 'p', tokens: 2 },
    } as unknown as AuthRequest;
    const res = mkRes();
    await createSellPostHandler(req, res, jest.fn());
    expect(service.createSellPost).toHaveBeenCalledWith('u', 'p', 2);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ _id: 'o1', side: 'SELL', status: 'ACTIVE' });
  });

  it('buy forwards service errors', async () => {
    (service.buy as jest.Mock).mockRejectedValue(Object.assign(new Error('no stock'), { status: 409 }));
    const req = {
      userId: 'u',
      header: () => undefined,
      body: { playerId: 'p', tokens: 1 },
    } as unknown as AuthRequest;
    const res = mkRes();
    const next = jest.fn();
    await buyHandler(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('createSellPost forwards service errors', async () => {
    (service.createSellPost as jest.Mock).mockRejectedValue(Object.assign(new Error('no stock'), { status: 409 }));
    const req = {
      userId: 'u',
      header: () => undefined,
      body: { playerId: 'p', tokens: 1 },
    } as unknown as AuthRequest;
    const res = mkRes();
    const next = jest.fn();
    await createSellPostHandler(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('cancelSellPost returns the cancelled order', async () => {
    (service.cancelSellPost as jest.Mock).mockResolvedValue({ _id: 'sell-1', status: 'CANCELLED' });
    const req = {
      userId: 'u',
      params: { id: 'sell-1' },
    } as unknown as AuthRequest;
    const res = mkRes();
    await cancelSellPostHandler(req, res, jest.fn());
    expect(service.cancelSellPost).toHaveBeenCalledWith('u', 'sell-1');
    expect(res.json).toHaveBeenCalledWith({ _id: 'sell-1', status: 'CANCELLED' });
  });

  it('getSellPostsHandler returns sell posts', async () => {
    (service.getSellPosts as jest.Mock).mockResolvedValue([{ _id: 'sp' }]);
    const req = { query: { playerId: 'p1' } } as unknown as AuthRequest;
    const res = mkRes();
    await getSellPostsHandler(req, res, jest.fn());
    expect(service.getSellPosts).toHaveBeenCalledWith('p1');
    expect(res.json).toHaveBeenCalledWith([{ _id: 'sp' }]);
  });
});