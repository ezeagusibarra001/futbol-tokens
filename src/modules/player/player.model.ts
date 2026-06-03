import { Schema, model, Document, Types } from 'mongoose';

export const LEAGUES = [
  'Premier League',
  'Bundesliga',
  'La Liga',
  'Serie A',
  'Ligue 1',
] as const;

export type League = typeof LEAGUES[number];

export interface IPlayer {
  externalId?: string;
  name: string;
  position: string;
  league: League | string;
  team: string;
  goals: number;
  assists: number;
  shots: number;
  rating: number;
  keyPasses: number;
  dribbles: number;
  tackles: number;
  minutesPlayed: number;
  yellowCards: number;
  redCards: number;
}

export interface IPlayerDoc extends IPlayer, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<IPlayerDoc>(
  {
    externalId: { type: String, index: true, sparse: true },
    name: { type: String, required: true, trim: true, index: true },
    position: { type: String, default: '', index: true },
    league: { type: String, required: true, index: true },
    team: { type: String, required: true, index: true },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    shots: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    keyPasses: { type: Number, default: 0 },
    dribbles: { type: Number, default: 0 },
    tackles: { type: Number, default: 0 },
    minutesPlayed: { type: Number, default: 0 },
    yellowCards: { type: Number, default: 0 },
    redCards: { type: Number, default: 0 },
  },
  { timestamps: true }
);

playerSchema.index({ name: 1, team: 1, league: 1 }, { unique: true });

export const Player = model<IPlayerDoc>('Player', playerSchema);
