import { Schema, model, Document, Types } from 'mongoose';

export interface IQuote {
  playerId: Types.ObjectId;
  value: number;
  score: number;
  strategyName: string;
  strategyVersion: string;
  at: Date;
}

export interface IQuoteDoc extends IQuote, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const quoteSchema = new Schema<IQuoteDoc>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    value: { type: Number, required: true },
    score: { type: Number, required: true },
    strategyName: { type: String, required: true, index: true },
    strategyVersion: { type: String, required: true },
    at: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: true }
);

quoteSchema.index({ playerId: 1, at: -1 });

export const Quote = model<IQuoteDoc>('Quote', quoteSchema);
