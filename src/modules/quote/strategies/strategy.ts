import { IPlayer } from '../../player/player.model';

export interface ValuationStrategy {
  readonly name: string;
  readonly version: string;
  score(player: IPlayer): number;
  price(score: number, base?: number): number;
}

export const BASE_VALUE = 1;
export const SCALE_FACTOR = 100;

const cap = (v: number, max: number): number => {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v > max ? 1 : v / max;
};

export const normalize = (player: IPlayer) => ({
  goals: cap(player.goals, 30),
  assists: cap(player.assists, 20),
  shots: cap(player.shots, 100),
  keyPasses: cap(player.keyPasses, 80),
  dribbles: cap(player.dribbles, 80),
  tackles: cap(player.tackles, 80),
  rating: cap(player.rating, 10),
  minutesPlayed: cap(player.minutesPlayed, 3000),
  yellowCards: cap(player.yellowCards, 15),
  redCards: cap(player.redCards, 3),
});

export const priceFromScore = (score: number, base = BASE_VALUE): number => {
  const safe = Math.max(0, score);
  return Number((base + safe * SCALE_FACTOR).toFixed(4));
};
