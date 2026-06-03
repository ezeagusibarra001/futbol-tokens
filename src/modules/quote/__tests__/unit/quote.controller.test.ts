import { Request, Response, NextFunction } from 'express';
import { recalculateHandler, getPlayerQuotesHandler, getRankingHandler } from '../../quote.controller';
import * as service from '../../quote.service';

jest.mock('../../quote.service');

beforeEach(() => jest.clearAllMocks());

const mkRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe('quote.controller', () => {
  it('recalculateHandler passes strategy and returns 200', async () => {
    (service.recalculateAll as jest.Mock).mockResolvedValue({ ok: true });
    const req = { body: { strategy: 'PositionAware' } } as Request;
    const res = mkRes();
    const next = jest.fn() as NextFunction;

    await recalculateHandler(req, res, next);

    expect(service.recalculateAll).toHaveBeenCalledWith('PositionAware');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('recalculateHandler forwards errors to next', async () => {
    (service.recalculateAll as jest.Mock).mockRejectedValue(new Error('boom'));
    const req = { body: {} } as Request;
    const res = mkRes();
    const next = jest.fn() as NextFunction;
    await recalculateHandler(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('getPlayerQuotesHandler parses from/to dates', async () => {
    (service.getPlayerQuotes as jest.Mock).mockResolvedValue([]);
    const req = {
      params: { id: 'p1' },
      query: { from: '2025-01-01', to: '2025-06-01' },
    } as unknown as Request;
    const res = mkRes();
    await getPlayerQuotesHandler(req, res, jest.fn());

    const args = (service.getPlayerQuotes as jest.Mock).mock.calls[0];
    expect(args[0]).toBe('p1');
    expect((args[1] as Date).toISOString()).toContain('2025-01-01');
    expect((args[2] as Date).toISOString()).toContain('2025-06-01');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getPlayerQuotesHandler returns 400 if id missing', async () => {
    const req = { params: {}, query: {} } as unknown as Request;
    const res = mkRes();
    await getPlayerQuotesHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('getRankingHandler clamps limit and delegates', async () => {
    (service.getRanking as jest.Mock).mockResolvedValue([]);
    const req = { query: { limit: '9999' } } as unknown as Request;
    const res = mkRes();
    await getRankingHandler(req, res, jest.fn());
    expect(service.getRanking).toHaveBeenCalledWith(500);
  });

  it('getRankingHandler uses default 50 with no query', async () => {
    (service.getRanking as jest.Mock).mockResolvedValue([]);
    const req = { query: {} } as unknown as Request;
    const res = mkRes();
    await getRankingHandler(req, res, jest.fn());
    expect(service.getRanking).toHaveBeenCalledWith(50);
  });
});
