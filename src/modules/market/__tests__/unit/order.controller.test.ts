import { Response } from 'express';
import { buyHandler, sellHandler } from '../../order.controller';
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
    (service.buy as jest.Mock).mockResolvedValue({ _id: 'o' });
    const req = {
      userId: 'u',
      header: jest.fn().mockReturnValue('idem-1'),
      body: { playerId: 'p', tokens: 3 },
    } as unknown as AuthRequest;
    const res = mkRes();
    await buyHandler(req, res, jest.fn());
    expect(service.buy).toHaveBeenCalledWith('u', 'p', 3, 'idem-1');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sell forwards service errors', async () => {
    (service.sell as jest.Mock).mockRejectedValue(Object.assign(new Error('no stock'), { status: 409 }));
    const req = {
      userId: 'u',
      header: () => undefined,
      body: { playerId: 'p', tokens: 1 },
    } as unknown as AuthRequest;
    const res = mkRes();
    const next = jest.fn();
    await sellHandler(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
