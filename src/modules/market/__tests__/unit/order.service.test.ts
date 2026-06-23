import { Types } from 'mongoose';
import { buy, createSellPost, cancelSellPost, createBid } from '../../order.service';
import { Holding } from '../../holding.model';
import { Order } from '../../order.model';
import * as marketService from '../../market.service';
import * as quoteService from '../../../quote/quote.service';
import * as playerRepo from '../../../player/player.repository';
import * as db from '../../../../config/db';

jest.mock('../../market.service');
jest.mock('../../../quote/quote.service');
jest.mock('../../../player/player.repository');

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
    exec: () => Promise.resolve(returnValue),
  } as unknown as ReturnType<typeof Order.findOne>);
};

const mockOrderFind = (returnValue: unknown) => {
  jest.spyOn(Order, 'find').mockReturnValueOnce({
    sort: () => ({ lean: () => ({ exec: () => Promise.resolve(returnValue) }) }),
  } as unknown as ReturnType<typeof Order.find>);
};

describe('order.service - validation', () => {
  it('rejects invalid userId on buy', async () => {
    await expect(buy('not-an-id', playerId.toString(), 5)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects non-positive tokens on buy', async () => {
    await expect(buy(userId.toString(), playerId.toString(), 0)).rejects.toMatchObject({ status: 400 });
    await expect(buy(userId.toString(), playerId.toString(), 1.5)).rejects.toMatchObject({ status: 400 });
  });

  it('throws 404 when player does not exist on buyFromSuperuser path', async () => {
    (playerRepo.findPlayerById as jest.Mock).mockResolvedValue(null);
    mockOrderFind([]);
    await expect(buy(userId.toString(), playerId.toString(), 5)).rejects.toMatchObject({ status: 404 });
  });

  it('forbids superuser buying from itself', async () => {
    setBasics();
    mockOrderFind([]);
    await expect(buy(suId.toString(), playerId.toString(), 1)).rejects.toMatchObject({ status: 400 });
  });
});

describe('order.service - BUY from superuser (no sell posts)', () => {
  it('creates an order, decrements superuser, credits buyer (new holding)', async () => {
    setBasics(10);
    mockOrderFind([]);
    mockHoldingFindOneAndUpdate({ _id: 'h-su', tokens: 99 });
    mockHoldingFindOne(null);
    jest.spyOn(Holding, 'create').mockResolvedValueOnce([{}] as never);
    jest.spyOn(Order, 'create').mockResolvedValueOnce([{ _id: 'ord-1', side: 'BUY' }] as never);

    const result = await buy(userId.toString(), playerId.toString(), 1);
    expect(result.source).toBe('superuser');
    expect(result.order).toMatchObject({ side: 'BUY' });
    expect(Holding.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: { $gte: 1 } }),
      { $inc: { tokens: -1 } },
      expect.objectContaining({ returnDocument: 'after' })
    );
    expect(Order.create).toHaveBeenCalledWith(
      [expect.objectContaining({ side: 'BUY', tokens: 1, pricePerToken: 10, total: 10 })],
      expect.objectContaining({ session: expect.anything() })
    );
  });

  it('recomputes avg price when buyer already holds tokens', async () => {
    setBasics(20);
    mockOrderFind([]);
    mockHoldingFindOneAndUpdate({ _id: 'h-su', tokens: 90 });
    const existing = { tokens: 10, avgBuyPrice: 5, save: jest.fn().mockResolvedValue(undefined) };
    mockHoldingFindOne(existing);
    jest.spyOn(Order, 'create').mockResolvedValueOnce([{ _id: 'o' }] as never);

    await buy(userId.toString(), playerId.toString(), 10);

    expect(existing.tokens).toBe(20);
    expect(existing.avgBuyPrice).toBeCloseTo(12.5, 5);
    expect(existing.save).toHaveBeenCalled();
  });

  it('throws 409 when superuser has no stock', async () => {
    setBasics();
    mockOrderFind([]);
    mockHoldingFindOneAndUpdate(null);
    await expect(buy(userId.toString(), playerId.toString(), 200)).rejects.toMatchObject({ status: 409 });
  });

  it('idempotency: returns existing order when key matches', async () => {
    setBasics();
    const existing = { _id: 'pre' };
    mockOrderFindOne(existing);
    const result = await buy(userId.toString(), playerId.toString(), 1, 'idem-1');
    expect(result.source).toBe('superuser');
    expect(result.order).toBe(existing);
    expect(Holding.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('order.service - BUY with sellOrderId', () => {
  it('throws when sellOrderId is invalid', async () => {
    await expect(buy(userId.toString(), playerId.toString(), 5, undefined, 'bad-id')).rejects.toMatchObject({ status: 400 });
  });
});

describe('order.service - createSellPost', () => {
  it('creates a sell post, moves tokens from seller to superuser escrow', async () => {
    setBasics(15);
    mockHoldingFindOneAndUpdate({ _id: 'h-user', tokens: 7 });
    const suHolding = { tokens: 100, save: jest.fn().mockResolvedValue(undefined) };
    mockHoldingFindOne(suHolding);
    mockOrderFind([]); // no resting bids to match
    jest.spyOn(Order, 'create').mockResolvedValueOnce([{ _id: 'sell-1', side: 'SELL', status: 'ACTIVE' }] as never);

    const order = await createSellPost(userId.toString(), playerId.toString(), 3);
    expect(order).toMatchObject({ side: 'SELL', status: 'ACTIVE' });
    expect(suHolding.tokens).toBe(103);
    expect(suHolding.save).toHaveBeenCalled();
    expect(Holding.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: userId, tokens: { $gte: 3 } }),
      { $inc: { tokens: -3 } },
      expect.anything()
    );
  });

  it('throws 409 when seller has insufficient tokens', async () => {
    setBasics();
    mockHoldingFindOneAndUpdate(null);
    await expect(createSellPost(userId.toString(), playerId.toString(), 5)).rejects.toMatchObject({ status: 409 });
  });

  it('forbids superuser from creating sell posts', async () => {
    setBasics();
    await expect(createSellPost(suId.toString(), playerId.toString(), 1)).rejects.toMatchObject({ status: 400 });
  });
});

const mockFindOneReturn = (returnValue: unknown) => ({
  session: () => ({ exec: () => Promise.resolve(returnValue) }),
  exec: () => Promise.resolve(returnValue),
});

describe('order.service - cancelSellPost', () => {
  it('cancels a sell post and returns tokens from escrow', async () => {
    const sellOrderId = new Types.ObjectId();
    const sellOrder = {
      _id: sellOrderId,
      userId,
      playerId,
      side: 'SELL' as const,
      status: 'ACTIVE' as const,
      tokens: 10,
      remainingTokens: 10,
      pricePerToken: 15,
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(Order, 'findOne').mockReturnValueOnce(mockFindOneReturn(sellOrder) as unknown as ReturnType<typeof Order.findOne>);
    mockHoldingFindOneAndUpdate({ _id: 'h-su', tokens: 90 });
    const userHolding = { tokens: 5, save: jest.fn().mockResolvedValue(undefined) };
    mockHoldingFindOne(userHolding);

    const cancelled = await cancelSellPost(userId.toString(), sellOrderId.toString());
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.remainingTokens).toBe(0);
    expect(userHolding.tokens).toBe(15);
    expect(userHolding.save).toHaveBeenCalled();
  });

  it('throws 403 when not the owner', async () => {
    const sellOrderId = new Types.ObjectId();
    const otherUserId = new Types.ObjectId();
    jest.spyOn(Order, 'findOne').mockReturnValueOnce(mockFindOneReturn({
      _id: sellOrderId,
      userId: otherUserId,
      playerId,
      side: 'SELL',
      status: 'ACTIVE',
      tokens: 10,
      remainingTokens: 10,
    }) as unknown as ReturnType<typeof Order.findOne>);
    await expect(cancelSellPost(userId.toString(), sellOrderId.toString())).rejects.toMatchObject({ status: 403 });
  });

  it('throws 404 when sell order not found', async () => {
    jest.spyOn(Order, 'findOne').mockReturnValueOnce(mockFindOneReturn(null) as unknown as ReturnType<typeof Order.findOne>);
    await expect(cancelSellPost(userId.toString(), new Types.ObjectId().toString())).rejects.toMatchObject({ status: 404 });
  });
});

const mockOrderFindOneAndUpdate = (returnValue: unknown) => {
  jest.spyOn(Order, 'findOneAndUpdate').mockReturnValueOnce({
    exec: () => Promise.resolve(returnValue),
  } as unknown as ReturnType<typeof Order.findOneAndUpdate>);
};

describe('order.service - createBid', () => {
  it('rejects invalid input', async () => {
    await expect(createBid('bad', playerId.toString(), 5)).rejects.toMatchObject({ status: 400 });
    await expect(createBid(userId.toString(), playerId.toString(), 0)).rejects.toMatchObject({ status: 400 });
  });

  it('forbids superuser from placing bids', async () => {
    setBasics();
    await expect(createBid(suId.toString(), playerId.toString(), 1)).rejects.toMatchObject({ status: 400 });
  });

  it('creates a pending bid when there are no matching sells', async () => {
    setBasics(10);
    mockOrderFind([]); // no active sells
    jest.spyOn(Order, 'create').mockResolvedValueOnce([
      { _id: 'bid-1', side: 'BUY', status: 'ACTIVE', remainingTokens: 5 },
    ] as never);

    const result = await createBid(userId.toString(), playerId.toString(), 5);
    expect(result.source).toBe('pending');
    expect(result.filled).toBe(0);
    expect(result.order).toMatchObject({ side: 'BUY', status: 'ACTIVE' });
  });

  it('fills against a resting sell at the current quote (p2p)', async () => {
    setBasics(20);
    const sellerId = new Types.ObjectId();
    const sellId = new Types.ObjectId();
    mockOrderFind([{ _id: sellId, userId: sellerId, remainingTokens: 10, tokens: 10 }]);
    mockOrderFindOneAndUpdate({ _id: sellId, remainingTokens: 5, status: 'ACTIVE', save: jest.fn() });
    // creditBuyerFromEscrow: escrow decrement ok, buyer has no prior holding
    mockHoldingFindOneAndUpdate({ _id: 'escrow', tokens: 90 });
    mockHoldingFindOne(null);
    jest.spyOn(Holding, 'create').mockResolvedValueOnce([{ _id: 'h-buyer' }] as never);
    jest.spyOn(Order, 'create').mockResolvedValueOnce([
      { _id: 'bid-2', side: 'BUY', status: 'FILLED', remainingTokens: 0 },
    ] as never);

    const result = await createBid(userId.toString(), playerId.toString(), 5);
    expect(result.source).toBe('p2p');
    expect(result.filled).toBe(5);
    expect(Holding.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: suId, tokens: { $gte: 5 } }),
      { $inc: { tokens: -5 } },
      expect.anything()
    );
  });
});