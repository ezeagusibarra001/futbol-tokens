import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from '../auth.middleware';

jest.mock('jsonwebtoken');

const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;
const mockRes = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
} as unknown as Response;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_ACCESS_SECRET = 'access_secret';
});

describe('authenticate middleware', () => {
  it('should call next() with userId set when token is valid', () => {
    (jwt.verify as jest.Mock).mockReturnValue({ sub: 'user123' });

    const req = {
      headers: { authorization: 'Bearer valid_token' },
    } as AuthRequest;

    authenticate(req, mockRes, mockNext);

    expect(req.userId).toBe('user123');
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should return 401 if Authorization header is missing', () => {
    const req = { headers: {} } as AuthRequest;

    authenticate(req, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header does not start with Bearer', () => {
    const req = {
      headers: { authorization: 'Basic sometoken' },
    } as AuthRequest;

    authenticate(req, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', () => {
    (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('invalid'); });

    const req = {
      headers: { authorization: 'Bearer bad_token' },
    } as AuthRequest;

    authenticate(req, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
