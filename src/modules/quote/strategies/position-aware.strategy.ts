import { IPlayer } from '../../player/player.model';
import { normalize, priceFromScore, ValuationStrategy } from './strategy';

type PositionGroup = 'FW' | 'MF' | 'DF' | 'GK';

const detectGroup = (raw: string): PositionGroup => {
  const p = (raw ?? '').toLowerCase();
  if (p.includes('gk') || p.includes('goal')) return 'GK';
  if (p.includes('def') || p.includes('df') || p.includes('back')) return 'DF';
  if (p.includes('mid') || p.includes('mf')) return 'MF';
  return 'FW';
};

const WEIGHTS: Record<PositionGroup, {
  goals: number; assists: number; shots: number; keyPasses: number;
  dribbles: number; tackles: number; rating: number;
}> = {
  FW: { goals: 0.35, assists: 0.15, shots: 0.15, keyPasses: 0.05, dribbles: 0.10, tackles: 0.02, rating: 0.18 },
  MF: { goals: 0.15, assists: 0.20, shots: 0.05, keyPasses: 0.20, dribbles: 0.10, tackles: 0.10, rating: 0.20 },
  DF: { goals: 0.05, assists: 0.05, shots: 0.02, keyPasses: 0.08, dribbles: 0.05, tackles: 0.45, rating: 0.30 },
  GK: { goals: 0.00, assists: 0.00, shots: 0.00, keyPasses: 0.00, dribbles: 0.00, tackles: 0.20, rating: 0.80 },
};

export class PositionAwareStrategy implements ValuationStrategy {
  readonly name = 'PositionAware';
  readonly version = '1.0.0';

  score(player: IPlayer): number {
    const n = normalize(player);
    const w = WEIGHTS[detectGroup(player.position)];
    const positive =
      w.goals * n.goals +
      w.assists * n.assists +
      w.shots * n.shots +
      w.keyPasses * n.keyPasses +
      w.dribbles * n.dribbles +
      w.tackles * n.tackles +
      w.rating * n.rating;
    const penalty = 0.05 * n.yellowCards + 0.15 * n.redCards;
    const score = positive - penalty;
    return Math.max(0, Number(score.toFixed(6)));
  }

  price(score: number, base?: number): number {
    return priceFromScore(score, base);
  }
}
