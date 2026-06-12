import { Types } from 'mongoose';
import { Holding } from './holding.model';
import { Order, IOrderDoc } from './order.model';
import { getSuperuser } from './market.service';
import { findPlayerById } from '../player/player.repository';
import { getEffectivePrice } from '../quote/quote.service';
import { withTx } from '../../config/db';
import {
  findActiveSellOrders,
  findActiveSellOrderById,
  updateOrderStatus,
} from './order.repository';

const err = (msg: string, status: number) => Object.assign(new Error(msg), { status });

const validateInput = (userId: string, playerId: string, tokens: number) => {
  if (!Types.ObjectId.isValid(userId)) throw err('Invalid userId', 400);
  if (!Types.ObjectId.isValid(playerId)) throw err('Invalid playerId', 400);
  if (!Number.isInteger(tokens) || tokens <= 0) throw err('tokens must be a positive integer', 400);
};

export const createSellPost = async (
  userId: string,
  playerId: string,
  tokens: number
): Promise<IOrderDoc> => {
  validateInput(userId, playerId, tokens);

  const player = await findPlayerById(playerId);
  if (!player) throw err('Player not found', 404);

  const price = await getEffectivePrice(playerId);
  const su = await getSuperuser();
  const sellerId = new Types.ObjectId(userId);
  const playerOid = new Types.ObjectId(playerId);
  const suId = su._id as Types.ObjectId;
  const total = Number((price.value * tokens).toFixed(6));

  if (sellerId.equals(suId)) throw err('Superuser cannot create sell posts', 400);

  return withTx(async session => {
    const decremented = await Holding.findOneAndUpdate(
      { userId: sellerId, playerId: playerOid, tokens: { $gte: tokens } },
      { $inc: { tokens: -tokens } },
      { returnDocument: 'after', session }
    ).exec();
    if (!decremented) throw err('Insufficient token balance to create sell post', 409);

    const suHolding = await Holding.findOne({ userId: suId, playerId: playerOid }).session(session).exec();
    if (suHolding) {
      suHolding.tokens += tokens;
      await suHolding.save({ session });
    } else {
      await Holding.create(
        [{ userId: suId, playerId: playerOid, tokens, avgBuyPrice: 0 }],
        { session }
      );
    }

    const [order] = await Order.create(
      [{
        userId: sellerId,
        playerId: playerOid,
        side: 'SELL',
        tokens,
        remainingTokens: tokens,
        pricePerToken: price.value,
        total,
        status: 'ACTIVE',
        ...omitIdem(undefined),
        strategyName: price.strategyName,
        strategyVersion: price.strategyVersion,
      }],
      { session }
    );
    return order;
  });
};

type P2pBuyResult = {
  source: 'p2p' | 'superuser';
  order: IOrderDoc;
};

const omitIdem = (key?: string): Record<string, string> =>
  key ? { idempotencyKey: key } : {};

const buyFromSellOrder = async (
  buyerId: Types.ObjectId,
  sellOrderId: Types.ObjectId,
  tokens: number,
  idempotencyKey?: string
): Promise<P2pBuyResult> => {
  const sellOrder = await findActiveSellOrderById(sellOrderId);
  if (!sellOrder) throw err('Sell order not found or no longer active', 404);
  const playerOid = sellOrder.playerId;
  const sellerId = sellOrder.userId;

  if (buyerId.equals(sellerId)) throw err('Cannot buy from your own sell order', 400);

  const price = await getEffectivePrice(playerOid.toString());
  const total = Number((price.value * tokens).toFixed(6));

  return withTx(async session => {
    const updated = await Order.findOneAndUpdate(
      {
        _id: sellOrderId,
        status: 'ACTIVE',
        remainingTokens: { $gte: tokens },
      },
      { $inc: { remainingTokens: -tokens } },
      { returnDocument: 'after', session }
    ).exec();
    if (!updated) throw err('Sell order no longer has enough tokens', 409);

    if (updated.remainingTokens === 0) {
      updated.status = 'FILLED';
      await updated.save({ session });
    }

    const su = await getSuperuser();
    const suId = su._id as Types.ObjectId;

    const decremented = await Holding.findOneAndUpdate(
      { userId: suId, playerId: playerOid, tokens: { $gte: tokens } },
      { $inc: { tokens: -tokens } },
      { returnDocument: 'after', session }
    ).exec();
    if (!decremented) throw err('Escrow balance error', 500);

    const buyerHolding = await Holding.findOne({ userId: buyerId, playerId: playerOid }).session(session).exec();
    if (buyerHolding) {
      const newTokens = buyerHolding.tokens + tokens;
      const newAvg = newTokens > 0
        ? ((buyerHolding.avgBuyPrice * buyerHolding.tokens) + total) / newTokens
        : 0;
      buyerHolding.tokens = newTokens;
      buyerHolding.avgBuyPrice = Number(newAvg.toFixed(6));
      await buyerHolding.save({ session });
    } else {
      await Holding.create(
        [{ userId: buyerId, playerId: playerOid, tokens, avgBuyPrice: price.value }],
        { session }
      );
    }

    const [order] = await Order.create(
      [{
        userId: buyerId,
        playerId: playerOid,
        side: 'BUY',
        tokens,
        pricePerToken: price.value,
        total,
        ...omitIdem(idempotencyKey),
        strategyName: price.strategyName,
        strategyVersion: price.strategyVersion,
      }],
      { session }
    );
    return { source: 'p2p' as const, order };
  });
};

const buyFromSuperuser = async (
  buyerId: Types.ObjectId,
  playerOid: Types.ObjectId,
  tokens: number,
  idempotencyKey?: string
): Promise<P2pBuyResult> => {
  const player = await findPlayerById(playerOid.toString());
  if (!player) throw err('Player not found', 404);

  const price = await getEffectivePrice(playerOid.toString());
  const su = await getSuperuser();
  const suId = su._id as Types.ObjectId;
  const total = Number((price.value * tokens).toFixed(6));

  if (buyerId.equals(suId)) throw err('Superuser cannot trade with itself', 400);

  const order = await withTx(async session => {
    const decremented = await Holding.findOneAndUpdate(
      { userId: suId, playerId: playerOid, tokens: { $gte: tokens } },
      { $inc: { tokens: -tokens } },
      { returnDocument: 'after', session }
    ).exec();
    if (!decremented) throw err('Not enough tokens available from superuser', 409);

    const buyerHolding = await Holding.findOne({ userId: buyerId, playerId: playerOid }).session(session).exec();
    if (buyerHolding) {
      const newTokens = buyerHolding.tokens + tokens;
      const newAvg = newTokens > 0
        ? ((buyerHolding.avgBuyPrice * buyerHolding.tokens) + total) / newTokens
        : 0;
      buyerHolding.tokens = newTokens;
      buyerHolding.avgBuyPrice = Number(newAvg.toFixed(6));
      await buyerHolding.save({ session });
    } else {
      await Holding.create(
        [{ userId: buyerId, playerId: playerOid, tokens, avgBuyPrice: price.value }],
        { session }
      );
    }

    const [o] = await Order.create(
      [{
        userId: buyerId,
        playerId: playerOid,
        side: 'BUY',
        tokens,
        pricePerToken: price.value,
        total,
        ...omitIdem(idempotencyKey),
        strategyName: price.strategyName,
        strategyVersion: price.strategyVersion,
      }],
      { session }
    );
    return o;
  });

  return { source: 'superuser' as const, order };
};

export const buy = async (
  userId: string,
  playerId: string,
  tokens: number,
  idempotencyKey?: string,
  sellOrderId?: string
): Promise<P2pBuyResult> => {
  validateInput(userId, playerId, tokens);

  const buyerId = new Types.ObjectId(userId);
  const playerOid = new Types.ObjectId(playerId);

  if (sellOrderId) {
    if (!Types.ObjectId.isValid(sellOrderId)) throw err('Invalid sellOrderId', 400);
    const targetId = new Types.ObjectId(sellOrderId);
    return buyFromSellOrder(buyerId, targetId, tokens);
  }

  if (idempotencyKey) {
    const existing = await Order.findOne({ userId: buyerId, idempotencyKey }).exec();
    if (existing) {
      return { source: 'superuser', order: existing };
    }
  }

  const activeSells = await findActiveSellOrders(playerOid);
  const matchingSell = activeSells.find(s => (s.remainingTokens ?? 0) >= tokens);
  if (matchingSell) {
    return buyFromSellOrder(buyerId, matchingSell._id, tokens, idempotencyKey);
  }

  return buyFromSuperuser(buyerId, playerOid, tokens, idempotencyKey);
};

export const cancelSellPost = async (
  userId: string,
  sellOrderId: string
): Promise<IOrderDoc> => {
  if (!Types.ObjectId.isValid(sellOrderId)) throw err('Invalid sellOrderId', 400);
  if (!Types.ObjectId.isValid(userId)) throw err('Invalid userId', 400);

  const sellOrderIdOid = new Types.ObjectId(sellOrderId);
  const userIdOid = new Types.ObjectId(userId);

  const sellOrder = await Order.findOne({ _id: sellOrderIdOid, side: 'SELL', status: 'ACTIVE' }).exec();
  if (!sellOrder) throw err('Active sell order not found', 404);

  if (!sellOrder.userId.equals(userIdOid)) throw err('Not your sell order', 403);

  const tokensToReturn = sellOrder.remainingTokens ?? sellOrder.tokens;
  const playerOid = sellOrder.playerId;

  return withTx(async session => {
    sellOrder.status = 'CANCELLED';
    sellOrder.remainingTokens = 0;
    await sellOrder.save({ session });

    const su = await getSuperuser();
    const suId = su._id as Types.ObjectId;

    const decremented = await Holding.findOneAndUpdate(
      { userId: suId, playerId: playerOid, tokens: { $gte: tokensToReturn } },
      { $inc: { tokens: -tokensToReturn } },
      { returnDocument: 'after', session }
    ).exec();
    if (!decremented) throw err('Escrow balance error during cancellation', 500);

    const userHolding = await Holding.findOne({ userId: userIdOid, playerId: playerOid }).session(session).exec();
    if (userHolding) {
      userHolding.tokens += tokensToReturn;
      await userHolding.save({ session });
    } else {
      await Holding.create(
        [{ userId: userIdOid, playerId: playerOid, tokens: tokensToReturn, avgBuyPrice: 0 }],
        { session }
      );
    }

    return sellOrder;
  });
};

export const getSellPosts = async (playerId?: string): Promise<IOrderDoc[]> => {
  let pid: Types.ObjectId | undefined;
  if (playerId) {
    if (!Types.ObjectId.isValid(playerId)) throw err('Invalid playerId', 400);
    pid = new Types.ObjectId(playerId);
  }
  return findActiveSellOrders(pid);
};