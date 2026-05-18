import { IPlayer } from '../../player/player.model';
import { PerformanceWeightedStrategy } from '../strategies/performance-weighted.strategy';
import { PositionAwareStrategy } from '../strategies/position-aware.strategy';
import { getStrategy, DEFAULT_STRATEGY } from '../strategies';
import { BASE_VALUE } from '../strategies/strategy';

const mkPlayer = (overrides: Partial<IPlayer> = {}): IPlayer => ({
  name: 'X',
  position: 'FW',
  league: 'PL',
  team: 'T',
  goals: 0,
  assists: 0,
  shots: 0,
  rating: 0,
  keyPasses: 0,
  dribbles: 0,
  tackles: 0,
  minutesPlayed: 0,
  yellowCards: 0,
  redCards: 0,
  ...overrides,
});

describe('PerformanceWeightedStrategy', () => {
  const s = new PerformanceWeightedStrategy();

  it('returns score 0 and price=base for an empty player', () => {
    const score = s.score(mkPlayer());
    expect(score).toBe(0);
    expect(s.price(score)).toBe(BASE_VALUE);
  });

  it('produces a higher score for a strong forward than a weak one', () => {
    const weak = s.score(mkPlayer({ goals: 1, rating: 6 }));
    const strong = s.score(mkPlayer({ goals: 20, assists: 10, shots: 80, rating: 8.5, keyPasses: 40 }));
    expect(strong).toBeGreaterThan(weak);
    expect(s.price(strong)).toBeGreaterThan(s.price(weak));
  });

  it('penalizes red cards', () => {
    const clean = s.score(mkPlayer({ goals: 5, rating: 7 }));
    const dirty = s.score(mkPlayer({ goals: 5, rating: 7, redCards: 2 }));
    expect(dirty).toBeLessThan(clean);
  });

  it('clamps score to >= 0', () => {
    const score = s.score(mkPlayer({ redCards: 3, yellowCards: 15 }));
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('declares a name and version', () => {
    expect(s.name).toBe('PerformanceWeighted');
    expect(s.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('PositionAwareStrategy', () => {
  const s = new PositionAwareStrategy();

  it('rewards goals more for FW than for DF', () => {
    const fw = s.score(mkPlayer({ position: 'FW', goals: 20 }));
    const df = s.score(mkPlayer({ position: 'DF', goals: 20 }));
    expect(fw).toBeGreaterThan(df);
  });

  it('rewards tackles more for DF than for FW', () => {
    const fw = s.score(mkPlayer({ position: 'FW', tackles: 60 }));
    const df = s.score(mkPlayer({ position: 'Defender', tackles: 60 }));
    expect(df).toBeGreaterThan(fw);
  });

  it('handles goalkeepers (rating dominated)', () => {
    const gk = s.score(mkPlayer({ position: 'GK', rating: 8, goals: 0 }));
    expect(gk).toBeGreaterThan(0);
  });
});

describe('strategy registry', () => {
  it('returns default when no name is given', () => {
    expect(getStrategy().name).toBe(DEFAULT_STRATEGY);
  });

  it('throws 400 for unknown strategy', () => {
    try {
      getStrategy('does-not-exist');
      fail('expected throw');
    } catch (e) {
      expect((e as { status: number }).status).toBe(400);
    }
  });
});
