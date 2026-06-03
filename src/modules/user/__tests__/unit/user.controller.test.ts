import { Response } from 'express';
import { getPortfolioHandler, getTransactionsHandler } from '../../user.controller';
import * as portfolio from '../../../market/portfolio.service';
import { AuthRequest } from '../../../auth/auth.middleware';

jest.mock('../../../market/portfolio.service');

beforeEach(() => jest.clearAllMocks());

const mkRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe('user.controller', () => {
  it('getPortfolio returns 200 with summary when accessing own data', async () => {
    (portfolio.getPortfolio as jest.Mock).mockResolvedValue({ positions: [], totals: {} });
    const req = { params: { id: 'u1' }, userId: 'u1' } as unknown as AuthRequest;
    const res = mkRes();
    await getPortfolioHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(portfolio.getPortfolio).toHaveBeenCalledWith('u1');
  });

  it('getPortfolio returns 403 when accessing another user', async () => {
    const req = { params: { id: 'u2' }, userId: 'u1' } as unknown as AuthRequest;
    const res = mkRes();
    await getPortfolioHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(portfolio.getPortfolio).not.toHaveBeenCalled();
  });

  it('getTransactions returns 200 when accessing own data', async () => {
    (portfolio.getUserTransactions as jest.Mock).mockResolvedValue([]);
    const req = { params: { id: 'u1' }, userId: 'u1' } as unknown as AuthRequest;
    const res = mkRes();
    await getTransactionsHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getTransactions returns 403 cross-user', async () => {
    const req = { params: { id: 'u2' }, userId: 'u1' } as unknown as AuthRequest;
    const res = mkRes();
    await getTransactionsHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('getPortfolio forwards service errors', async () => {
    (portfolio.getPortfolio as jest.Mock).mockRejectedValue(new Error('db error'));
    const req = { params: { id: 'u1' }, userId: 'u1' } as unknown as AuthRequest;
    const res = mkRes();
    const next = jest.fn();
    await getPortfolioHandler(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('getTransactions forwards service errors', async () => {
    (portfolio.getUserTransactions as jest.Mock).mockRejectedValue(new Error('db error'));
    const req = { params: { id: 'u1' }, userId: 'u1' } as unknown as AuthRequest;
    const res = mkRes();
    const next = jest.fn();
    await getTransactionsHandler(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
