import { Types } from 'mongoose';
import { Holding, IHoldingDoc } from './holding.model';
import { Order, IOrderDoc, OrderSide } from './order.model';
import { getSuperuser } from './market.service';
import { findPlayerById } from '../player/player.repository';
import { getEffectivePrice } from '../quote/quote.service';
import { withTx } from '../../config/db';

const err = (msg: string, status: number) => Object.assign(new Error(msg), { status });

const validateInput = (userId: string, playerId: string, tokens: number) => {
  if (!Types.ObjectId.isValid(userId)) throw err('Invalid userId', 400);
  if (!Types.ObjectId.isValid(playerId)) throw err('Invalid playerId', 400);
  if (!Number.isInteger(tokens) || tokens <= 0) throw err('tokens must be a positive integer', 400);
};

type ExecuteArgs = {
  userId: string;
  playerId: string;
  tokens: number;
  side: OrderSide;
  idempotencyKey?: string;
};

const execute = async ({ userId, playerId, tokens, side, idempotencyKey }: ExecuteArgs): Promise<IOrderDoc> => {
  validateInput(userId, playerId, tokens);

  const player = await findPlayerById(playerId);
  if (!player) throw err('Player not found', 404);

  const price = await getEffectivePrice(playerId);
  const su = await getSuperuser();
  const buyerId = new Types.ObjectId(userId);
  const playerOid = new Types.ObjectId(playerId);
  const suId = su._id as Types.ObjectId;
  const total = Number((price.value * tokens).toFixed(6));

  if (buyerId.equals(suId)) throw err('Superuser cannot trade with itself', 400);

  return withTx(async session => {
    if (idempotencyKey) {
      const existing = await Order.findOne({ userId: buyerId, idempotencyKey }).session(session).exec();
      if (existing) return existing;
    }

    const fromUserId = side === 'BUY' ? suId : buyerId;
    const toUserId = side === 'BUY' ? buyerId : suId;

    const decremented = await Holding.findOneAndUpdate(
      { userId: fromUserId, playerId: playerOid, tokens: { $gte: tokens } },
      { $inc: { tokens: -tokens } },
      { returnDocument: 'after', session }
    ).exec();
    if (!decremented) {
      const msg = side === 'BUY' ? 'Not enough tokens available' : 'Insufficient token balance to sell';
      throw err(msg, 409);
    }

    const dest = await Holding.findOne({ userId: toUserId, playerId: playerOid }).session(session).exec() as IHoldingDoc | null;
    if (dest) {
      if (side === 'BUY') {
        const newTokens = dest.tokens + tokens;
        const newAvg = newTokens > 0
          ? ((dest.avgBuyPrice * dest.tokens) + total) / newTokens
          : 0;
        dest.tokens = newTokens;
        dest.avgBuyPrice = Number(newAvg.toFixed(6));
      } else {
        dest.tokens = dest.tokens + tokens;
      }
      await dest.save({ session });
    } else {
      await Holding.create(
        [{
          userId: toUserId,
          playerId: playerOid,
          tokens,
          avgBuyPrice: side === 'BUY' ? price.value : 0,
        }],
        { session }
      );
    }

    const [order] = await Order.create(
      [{
        userId: buyerId,
        playerId: playerOid,
        side,
        tokens,
        pricePerToken: price.value,
        total,
        idempotencyKey,
        strategyName: price.strategyName,
        strategyVersion: price.strategyVersion,
      }],
      { session }
    );
    return order;
  });
};

export const buy = (userId: string, playerId: string, tokens: number, idempotencyKey?: string) =>
  execute({ userId, playerId, tokens, side: 'BUY', idempotencyKey });

export const sell = (userId: string, playerId: string, tokens: number, idempotencyKey?: string) =>
  execute({ userId, playerId, tokens, side: 'SELL', idempotencyKey });
