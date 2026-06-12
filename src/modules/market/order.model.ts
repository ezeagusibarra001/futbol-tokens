import { Schema, model, Document, Types } from 'mongoose';

export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'ACTIVE' | 'FILLED' | 'CANCELLED';

export interface IOrder {
  userId: Types.ObjectId;
  playerId: Types.ObjectId;
  side: OrderSide;
  tokens: number;
  remainingTokens?: number;
  pricePerToken: number;
  total: number;
  status?: OrderStatus;
  idempotencyKey?: string;
  strategyName?: string;
  strategyVersion?: string;
}

export interface IOrderDoc extends IOrder, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrderDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    side: { type: String, enum: ['BUY', 'SELL'], required: true },
    tokens: { type: Number, required: true, min: 1 },
    remainingTokens: { type: Number, min: 0 },
    pricePerToken: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['ACTIVE', 'FILLED', 'CANCELLED'] },
    idempotencyKey: { type: String },
    strategyName: { type: String },
    strategyVersion: { type: String },
  },
  { timestamps: true }
);

orderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
orderSchema.index({ status: 1, playerId: 1 });
orderSchema.index({ status: 1, remainingTokens: 1 });

export const Order = model<IOrderDoc>('Order', orderSchema);
