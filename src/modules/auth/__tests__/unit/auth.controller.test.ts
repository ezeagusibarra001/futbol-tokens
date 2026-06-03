import { Request, Response } from 'express';
import * as service from '../../auth.service';
import { registerHandler, loginHandler, refreshHandler, logoutHandler } from '../../auth.controller';

jest.mock('../../auth.service');

const mkRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
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

  it('register forwards service errors', async () => {
    (service.register as jest.Mock).mockRejectedValue(Object.assign(new Error('dup'), { status: 409 }));
    const req = { body: { email: 'a@b.com', password: 'pw' } } as Request;
    const res = mkRes();
    const next = jest.fn();
    await registerHandler(req, res, next);
    expect(next).toHaveBeenCalled();
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

  it('refresh returns 200 with tokens', async () => {
    (service.refresh as jest.Mock).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    const req = { body: { refreshToken: 'rt' } } as Request;
    const res = mkRes();
    await refreshHandler(req, res, jest.fn());
    expect(service.refresh).toHaveBeenCalledWith('rt');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('refresh validates required field', async () => {
    const req = { body: {} } as Request;
    const res = mkRes();
    await refreshHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.refresh).not.toHaveBeenCalled();
  });

  it('refresh forwards service errors', async () => {
    (service.refresh as jest.Mock).mockRejectedValue(Object.assign(new Error('expired'), { status: 401 }));
    const req = { body: { refreshToken: 'bad' } } as Request;
    const res = mkRes();
    const next = jest.fn();
    await refreshHandler(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('logout returns 204', async () => {
    (service.logout as jest.Mock).mockResolvedValue(undefined);
    const req = { body: { refreshToken: 'rt' } } as Request;
    const res = mkRes();
    await logoutHandler(req, res, jest.fn());
    expect(service.logout).toHaveBeenCalledWith('rt');
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('logout validates required field', async () => {
    const req = { body: {} } as Request;
    const res = mkRes();
    await logoutHandler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.logout).not.toHaveBeenCalled();
  });

  it('logout forwards service errors', async () => {
    (service.logout as jest.Mock).mockRejectedValue(Object.assign(new Error('invalid'), { status: 401 }));
    const req = { body: { refreshToken: 'bad' } } as Request;
    const res = mkRes();
    const next = jest.fn();
    await logoutHandler(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
