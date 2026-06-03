import { Types } from 'mongoose';
import { Order, IOrder } from '../../order.model';
import {
  createOrder,
  findOrderByIdempotencyKey,
  findOrdersByUser,
} from '../../order.repository';

jest.mock('../../order.model');

const uid = new Types.ObjectId();
const pid = new Types.ObjectId();

const mockOrderData: IOrder = {
  userId: uid,
  playerId: pid,
  side: 'BUY',
  tokens: 5,
  pricePerToken: 10,
  total: 50,
  idempotencyKey: 'idem-1',
  strategyName: 'PerformanceWeighted',
  strategyVersion: '1.0',
};

describe('order.repository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createOrder', () => {
    it('creates an order without session', async () => {
      (Order.create as jest.Mock).mockResolvedValue([{ ...mockOrderData, _id: 'o1' }]);

      const result = await createOrder(mockOrderData);

      expect(Order.create).toHaveBeenCalledWith([mockOrderData], {});
      expect(result._id).toBe('o1');
    });

    it('creates an order with session', async () => {
      (Order.create as jest.Mock).mockResolvedValue([{ ...mockOrderData, _id: 'o1' }]);
      const ses = { id: 1 } as any;

      const result = await createOrder(mockOrderData, ses);

      expect(Order.create).toHaveBeenCalledWith([mockOrderData], { session: ses });
      expect(result._id).toBe('o1');
    });
  });

  describe('findOrderByIdempotencyKey', () => {
    const queryObj = () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      return { session: jest.fn().mockReturnThis(), exec: mockExec };
    };

    it('queries without session when not provided', async () => {
      const q = queryObj();
      (Order.findOne as jest.Mock).mockReturnValue(q);

      await findOrderByIdempotencyKey(uid, 'key-1');

      expect(Order.findOne).toHaveBeenCalledWith({ userId: uid, idempotencyKey: 'key-1' });
    });

    it('attaches session when provided', async () => {
      const q = queryObj();
      (Order.findOne as jest.Mock).mockReturnValue(q);

      const ses = { id: 1 } as any;
      await findOrderByIdempotencyKey(uid, 'key-1', ses);

      expect(q.session).toHaveBeenCalledWith(ses);
    });
  });

  describe('findOrdersByUser', () => {
    it('returns empty array for invalid ObjectId', async () => {
      const result = await findOrdersByUser('bad-id');
      expect(result).toEqual([]);
      expect(Order.find).not.toHaveBeenCalled();
    });

    it('queries by userId with sort', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      const mockSort = jest.fn(() => ({ lean: () => ({ exec: mockExec }) }));
      const mockLean = jest.fn(() => ({ exec: mockExec }));
      (Order.find as jest.Mock).mockReturnValue({ sort: () => ({ lean: () => ({ exec: mockExec }) }) });

      await findOrdersByUser(uid.toString());

      expect(Order.find).toHaveBeenCalledWith({ userId: uid });
    });
  });
});
