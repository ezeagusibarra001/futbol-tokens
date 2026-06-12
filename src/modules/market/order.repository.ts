import { ClientSession, Types } from 'mongoose';
import { Order, IOrder, IOrderDoc } from './order.model';

export const createOrder = async (data: IOrder, session?: ClientSession): Promise<IOrderDoc> => {
  const [doc] = await Order.create([data], session ? { session } : {});
  return doc;
};

export const findOrderByIdempotencyKey = (
  userId: Types.ObjectId,
  key: string,
  session?: ClientSession
): Promise<IOrderDoc | null> => {
  const q = Order.findOne({ userId, idempotencyKey: key });
  if (session) q.session(session);
  return q.exec();
};

export const findOrdersByUser = (userId: string): Promise<IOrderDoc[]> => {
  if (!Types.ObjectId.isValid(userId)) return Promise.resolve([]);
  return Order.find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean<IOrderDoc[]>()
    .exec();
};

export const findActiveSellOrders = (
  playerId?: Types.ObjectId
): Promise<IOrderDoc[]> => {
  const filter: Record<string, unknown> = {
    side: 'SELL',
    status: 'ACTIVE',
    remainingTokens: { $gte: 1 },
  };
  if (playerId) filter.playerId = playerId;
  return Order.find(filter)
    .sort({ createdAt: 1 })
    .lean<IOrderDoc[]>()
    .exec();
};

export const findActiveSellOrderById = (
  id: Types.ObjectId
): Promise<IOrderDoc | null> => {
  if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
  return Order.findOne({ _id: id, side: 'SELL', status: 'ACTIVE' }).exec();
};

export const updateOrderStatus = (
  id: Types.ObjectId,
  status: 'FILLED' | 'CANCELLED',
  session?: ClientSession
): Promise<IOrderDoc | null> => {
  const q = Order.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: 'after' });
  if (session) q.session(session);
  return q.exec();
};
