import mongoose from 'mongoose';
import { withTx } from '../../db';

jest.mock('mongoose');

describe('withTx', () => {
  const mockSession = {
    withTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mongoose.startSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it('starts a session, runs transaction, ends session', async () => {
    mockSession.withTransaction.mockImplementation(async (fn: () => Promise<void>) => {
      await fn();
    });

    const fn = jest.fn().mockResolvedValue('result');
    const result = await withTx(fn);

    expect(mongoose.startSession).toHaveBeenCalledTimes(1);
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(mockSession);
    expect(result).toBe('result');
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('ends session even if transaction throws', async () => {
    mockSession.withTransaction.mockRejectedValue(new Error('tx failed'));

    await expect(withTx(jest.fn())).rejects.toThrow('tx failed');
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });
});
