import { Schema, model, Document, Types } from 'mongoose';

export interface IHolding {
  userId: Types.ObjectId;
  playerId: Types.ObjectId;
  tokens: number;
  avgBuyPrice: number;
}

export interface IHoldingDoc extends IHolding, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const holdingSchema = new Schema<IHoldingDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    tokens: { type: Number, required: true, default: 0, min: 0 },
    avgBuyPrice: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

holdingSchema.index({ userId: 1, playerId: 1 }, { unique: true });

export const Holding = model<IHoldingDoc>('Holding', holdingSchema);
