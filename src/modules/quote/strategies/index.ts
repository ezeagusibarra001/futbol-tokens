import { ValuationStrategy } from './strategy';
import { PerformanceWeightedStrategy } from './performance-weighted.strategy';
import { PositionAwareStrategy } from './position-aware.strategy';

export const STRATEGIES: Record<string, ValuationStrategy> = {
  PerformanceWeighted: new PerformanceWeightedStrategy(),
  PositionAware: new PositionAwareStrategy(),
};

export const DEFAULT_STRATEGY = 'PerformanceWeighted';

export const getStrategy = (name?: string): ValuationStrategy => {
  const key = name ?? DEFAULT_STRATEGY;
  const s = STRATEGIES[key];
  if (!s) {
    throw Object.assign(new Error(`Unknown strategy: ${key}`), { status: 400 });
  }
  return s;
};

export { ValuationStrategy };
