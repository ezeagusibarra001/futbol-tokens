import { Request, Response } from 'express';
import * as service from '../auth.service';
import { registerHandler, loginHandler } from '../auth.controller';

jest.mock('../auth.service');

const mkRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

beforeEach(() => jest.clearAllMocks());

describe('auth.controller', () => {
  it('register returns 201 with tokens', async () => {
    (service.register as jest.Mock).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    const req = { body: { email: 'a@b.com', password: 'pw' } } as Request;
    const res = mkRes();
    await registerHandler(req, res, jest.fn());
    expect(service.register).toHaveBeenCalledWith('a@b.com', 'pw');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('register validates required fields', async () => {
    const req = { body: {} } as Request;
    const res = mkRes();
    await registerHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.register).not.toHaveBeenCalled();
  });

  it('login returns 200 with tokens', async () => {
    (service.login as jest.Mock).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    const req = { body: { email: 'a@b.com', password: 'pw' } } as Request;
    const res = mkRes();
    await loginHandler(req, res, jest.fn());
    expect(service.login).toHaveBeenCalledWith('a@b.com', 'pw');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('login forwards service errors', async () => {
    (service.login as jest.Mock).mockRejectedValue(Object.assign(new Error('nope'), { status: 401 }));
    const req = { body: { email: 'a@b.com', password: 'x' } } as Request;
    const res = mkRes();
    const next = jest.fn();
    await loginHandler(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
