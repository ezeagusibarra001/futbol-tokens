import { Schema } from 'mongoose';
import { dbQueryDuration, dbOperationsTotal } from '../modules/monitor/monitor.service';

function record(operation: string, collection: string, start: number): void {
  const duration = Date.now() - start;
  dbQueryDuration.observe({ operation, collection }, duration);
  dbOperationsTotal.inc({ operation, collection });
}

function resolveCollection(ctx: Record<string, unknown>): string {
  const model = (ctx as unknown as { model?: { collection?: { name?: string } } }).model;
  if (model?.collection?.name) return model.collection.name;
  const constructor = (ctx as unknown as { constructor?: { modelName?: string } }).constructor;
  if (constructor?.modelName) return constructor.modelName;
  return 'unknown';
}

const QUERY_OPS = [
  'find', 'findOne', 'findById',
  'countDocuments', 'estimatedDocumentCount',
  'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
  'findByIdAndUpdate', 'findByIdAndDelete', 'findByIdAndReplace',
  'deleteOne', 'deleteMany',
  'updateOne', 'updateMany',
];

export function mongooseMetricsPlugin(schema: Schema): void {
  const s = schema as unknown as {
    pre: (name: string, fn: (this: Record<string, unknown>) => void) => void;
    post: (name: string, fn: (this: Record<string, unknown>) => void) => void;
  };

  for (const op of QUERY_OPS) {
    s.pre(op, function (this: Record<string, unknown>) {
      this._metricsStart = Date.now();
    });
    s.post(op, function (this: Record<string, unknown>) {
      const col = resolveCollection(this);
      record(op, col, this._metricsStart as number || Date.now());
    });
  }

  s.pre('aggregate', function (this: Record<string, unknown>) {
    this._metricsStart = Date.now();
  });
  s.post('aggregate', function (this: Record<string, unknown>) {
    const col = resolveCollection(this);
    record('aggregate', col, this._metricsStart as number || Date.now());
  });

  s.pre('insertMany', function (this: Record<string, unknown>) {
    this._metricsStart = Date.now();
  });
  s.post('insertMany', function (this: Record<string, unknown>) {
    const col = resolveCollection(this);
    record('insertMany', col, this._metricsStart as number || Date.now());
  });

  s.pre('save', function (this: Record<string, unknown>) {
    this._metricsStart = Date.now();
  });
  s.post('save', function (this: Record<string, unknown>) {
    const col = resolveCollection(this);
    record('save', col, this._metricsStart as number || Date.now());
  });
}
