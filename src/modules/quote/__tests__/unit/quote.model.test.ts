import { Types } from 'mongoose';
import { Quote } from '../../quote.model';

describe('Quote mongoose model', () => {
  it('defaults at to a Date via default function', () => {
    const doc = new Quote({
      playerId: new Types.ObjectId(),
      value: 50,
      score: 0.5,
      strategyName: 'PerformanceWeighted',
      strategyVersion: '1.0',
    });
    expect(doc.at).toBeInstanceOf(Date);
    expect(doc.value).toBe(50);
    expect(doc.score).toBe(0.5);
    expect(doc.strategyName).toBe('PerformanceWeighted');
    expect(doc.strategyVersion).toBe('1.0');
  });

  it('fails validation without required fields', async () => {
    const doc = new Quote({});
    await expect(doc.validate()).rejects.toThrow();
  });

  it('fails validation without playerId', async () => {
    const doc = new Quote({ value: 50, score: 0.5, strategyName: 'PW', strategyVersion: '1' });
    await expect(doc.validate()).rejects.toThrow();
  });

  it('fails validation without value', async () => {
    const doc = new Quote({ playerId: new Types.ObjectId(), score: 0.5, strategyName: 'PW', strategyVersion: '1' });
    await expect(doc.validate()).rejects.toThrow();
  });

  it('fails validation without strategyName', async () => {
    const doc = new Quote({ playerId: new Types.ObjectId(), value: 50, score: 0.5, strategyVersion: '1' });
    await expect(doc.validate()).rejects.toThrow();
  });

  it('accepts a well-formed quote document', async () => {
    const doc = new Quote({
      playerId: new Types.ObjectId(),
      value: 100,
      score: 0.8,
      strategyName: 'PositionAware',
      strategyVersion: '2.0',
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });
});
