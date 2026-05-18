import { Schema, model, Document, Types } from 'mongoose';

export type OrderSide = 'BUY' | 'SELL';

export interface IOrder {
  userId: Types.ObjectId;
  playerId: Types.ObjectId;
  side: OrderSide;
  tokens: number;
  pricePerToken: number;
  total: number;
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
    pricePerToken: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    idempotencyKey: { type: String, index: true, sparse: true },
    strategyName: { type: String },
    strategyVersion: { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

export const Order = model<IOrderDoc>('Order', orderSchema);
