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
