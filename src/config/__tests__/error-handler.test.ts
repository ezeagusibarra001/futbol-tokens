import { Request, Response } from 'express';
import { errorHandler, httpError, requestLogger } from '../error-handler';
import { logger } from '../logger';

const mkRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

beforeEach(() => {
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('errorHandler', () => {
  it('maps an HttpError status and exposes its message', () => {
    const err = httpError('not found', 404);
    const res = mkRes();
    errorHandler(err, { method: 'GET', path: '/x' } as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'not found' });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('defaults to 500 and hides message for unknown errors', () => {
    const res = mkRes();
    errorHandler(new Error('secret stacktrace') as never, { method: 'GET', path: '/x' } as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('requestLogger', () => {
  it('logs the request when the response finishes', () => {
    const handlers: Record<string, () => void> = {};
    const req = { method: 'GET', path: '/foo' } as Request;
    const res = {
      statusCode: 201,
      on: (ev: string, cb: () => void) => { handlers[ev] = cb; },
    } as unknown as Response;
    requestLogger(req, res, jest.fn());
    handlers['finish']?.();
    expect(logger.info).toHaveBeenCalledWith(
      'GET /foo',
      expect.objectContaining({ status: 201, ms: expect.any(Number) })
    );
  });
});
