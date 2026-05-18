import { Types } from 'mongoose';
import { buy, sell } from '../order.service';
import { Holding } from '../holding.model';
import { Order } from '../order.model';
import * as marketService from '../market.service';
import * as quoteService from '../../quote/quote.service';
import * as playerRepo from '../../player/player.repository';
import * as db from '../../../config/db';

jest.mock('../market.service');
jest.mock('../../quote/quote.service');
jest.mock('../../player/player.repository');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(db, 'withTx').mockImplementation(async (fn) => fn({} as never));
});

const suId = new Types.ObjectId();
const userId = new Types.ObjectId();
const playerId = new Types.ObjectId();

const setBasics = (price = 10) => {
  (playerRepo.findPlayerById as jest.Mock).mockResolvedValue({ _id: playerId, name: 'P' });
  (marketService.getSuperuser as jest.Mock).mockResolvedValue({ _id: suId });
  (quoteService.getEffectivePrice as jest.Mock).mockResolvedValue({
    value: price, strategyName: 'PerformanceWeighted', strategyVersion: '1.0.0',
  });
};

const mockHoldingFindOneAndUpdate = (returnValue: unknown) => {
  jest.spyOn(Holding, 'findOneAndUpdate').mockReturnValueOnce({
    exec: () => Promise.resolve(returnValue),
  } as unknown as ReturnType<typeof Holding.findOneAndUpdate>);
};

const mockHoldingFindOne = (returnValue: unknown) => {
  jest.spyOn(Holding, 'findOne').mockReturnValueOnce({
    session: () => ({ exec: () => Promise.resolve(returnValue) }),
  } as unknown as ReturnType<typeof Holding.findOne>);
};

const mockOrderFindOne = (returnValue: unknown) => {
  jest.spyOn(Order, 'findOne').mockReturnValueOnce({
    session: () => ({ exec: () => Promise.resolve(returnValue) }),
  } as unknown as ReturnType<typeof Order.findOne>);
};

describe('order.service - validation', () => {
  it('rejects invalid userId', async () => {
    await expect(buy('not-an-id', playerId.toString(), 5)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects non-positive tokens', async () => {
    await expect(buy(userId.toString(), playerId.toString(), 0)).rejects.toMatchObject({ status: 400 });
    await expect(buy(userId.toString(), playerId.toString(), 1.5)).rejects.toMatchObject({ status: 400 });
  });

  it('throws 404 when player does not exist', async () => {
    (playerRepo.findPlayerById as jest.Mock).mockResolvedValue(null);
    await expect(buy(userId.toString(), playerId.toString(), 5)).rejects.toMatchObject({ status: 404 });
  });

  it('forbids superuser trading with itself', async () => {
    setBasics();
    await expect(buy(suId.toString(), playerId.toString(), 1)).rejects.toMatchObject({ status: 400 });
  });
});

describe('order.service - BUY', () => {
  it('creates an order, decrements superuser, credits buyer (new holding)', async () => {
    setBasics(10);
    mockHoldingFindOneAndUpdate({ _id: 'h-su', tokens: 99 });
    mockHoldingFindOne(null);
    jest.spyOn(Holding, 'create').mockResolvedValueOnce([{}] as never);
    jest.spyOn(Order, 'create').mockResolvedValueOnce([{ _id: 'ord-1', side: 'BUY' }] as never);

    const order = await buy(userId.toString(), playerId.toString(), 1);
    expect(order).toMatchObject({ side: 'BUY' });
    expect(Holding.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: { $gte: 1 } }),
      { $inc: { tokens: -1 } },
      expect.objectContaining({ new: true })
    );
    expect(Order.create).toHaveBeenCalledWith(
      [expect.objectContaining({ side: 'BUY', tokens: 1, pricePerToken: 10, total: 10 })],
      expect.objectContaining({ session: expect.anything() })
    );
  });

  it('recomputes avg price when buyer already holds tokens', async () => {
    setBasics(20);
    mockHoldingFindOneAndUpdate({ _id: 'h-su', tokens: 90 });
    const existing = { tokens: 10, avgBuyPrice: 5, save: jest.fn().mockResolvedValue(undefined) };
    mockHoldingFindOne(existing);
    jest.spyOn(Order, 'create').mockResolvedValueOnce([{ _id: 'o' }] as never);

    await buy(userId.toString(), playerId.toString(), 10);

    expect(existing.tokens).toBe(20);
    // newAvg = (5*10 + 20*10) / 20 = 12.5
    expect(existing.avgBuyPrice).toBeCloseTo(12.5, 5);
    expect(existing.save).toHaveBeenCalled();
  });

  it('throws 409 when superuser has no stock', async () => {
    setBasics();
    mockHoldingFindOneAndUpdate(null);
    await expect(buy(userId.toString(), playerId.toString(), 200)).rejects.toMatchObject({ status: 409 });
  });

  it('idempotency: returns existing order when key matches', async () => {
    setBasics();
    const existing = { _id: 'pre' };
    mockOrderFindOne(existing);
    const got = await buy(userId.toString(), playerId.toString(), 1, 'idem-1');
    expect(got).toBe(existing);
    expect(Holding.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('order.service - SELL', () => {
  it('debits seller and credits superuser', async () => {
    setBasics(8);
    mockHoldingFindOneAndUpdate({ _id: 'h-user', tokens: 5 });
    const suHolding = { tokens: 100, save: jest.fn().mockResolvedValue(undefined) };
    mockHoldingFindOne(suHolding);
    jest.spyOn(Order, 'create').mockResolvedValueOnce([{ _id: 'o', side: 'SELL' }] as never);

    const order = await sell(userId.toString(), playerId.toString(), 3);
    expect(order).toMatchObject({ side: 'SELL' });
    expect(suHolding.tokens).toBe(103);
    expect(suHolding.save).toHaveBeenCalled();
  });

  it('throws 409 when seller has not enough tokens', async () => {
    setBasics();
    mockHoldingFindOneAndUpdate(null);
    await expect(sell(userId.toString(), playerId.toString(), 5)).rejects.toMatchObject({ status: 409 });
  });
});
