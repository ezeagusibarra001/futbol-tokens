import { IPlayer } from '../../player/player.model';
import { normalize, priceFromScore, ValuationStrategy } from './strategy';

export class PerformanceWeightedStrategy implements ValuationStrategy {
  readonly name = 'PerformanceWeighted';
  readonly version = '1.0.0';

  score(player: IPlayer): number {
    const n = normalize(player);
    const positive =
      0.25 * n.goals +
      0.15 * n.assists +
      0.10 * n.shots +
      0.10 * n.keyPasses +
      0.10 * n.dribbles +
      0.10 * n.tackles +
      0.20 * n.rating;
    const penalty = 0.05 * n.yellowCards + 0.15 * n.redCards;
    const score = positive - penalty;
    return Math.max(0, Number(score.toFixed(6)));
  }

  price(score: number, base?: number): number {
    return priceFromScore(score, base);
  }
}
