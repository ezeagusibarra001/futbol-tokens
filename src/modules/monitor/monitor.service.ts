import client from 'prom-client';
import mongoose from 'mongoose';
import os from 'os';
import { User } from '../auth/user.model';
import { Order } from '../market/order.model';
import { Holding } from '../market/holding.model';
import { Player } from '../player/player.model';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'path', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_ms',
  help: 'Duration of database queries in ms',
  labelNames: ['operation', 'collection'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  registers: [register],
});

export const tokenTradesTotal = new client.Counter({
  name: 'token_trades_total',
  help: 'Total number of token trades (buy/sell)',
  labelNames: ['side', 'player_id'],
  registers: [register],
});

export const activeUsersGauge = new client.Gauge({
  name: 'active_users',
  help: 'Number of currently active users',
  registers: [register],
});

export const registeredUsersTotal = new client.Gauge({
  name: 'registered_users_total',
  help: 'Total number of registered users',
  labelNames: [],
  registers: [register],
});

export const activeSellPostsGauge = new client.Gauge({
  name: 'active_sell_posts',
  help: 'Number of active sell posts',
  labelNames: ['player_name'],
  registers: [register],
});

export const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors (4xx, 5xx)',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export const dbOperationsTotal = new client.Counter({
  name: 'db_operations_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'collection'],
  registers: [register],
});

export const portfolioValueGauge = new client.Gauge({
  name: 'portfolio_value_total',
  help: 'Total portfolio value across all users',
  registers: [register],
});

export const holdingsDistribution = new client.Gauge({
  name: 'holdings_per_player',
  help: 'Number of holdings per player',
  labelNames: ['player_name'],
  registers: [register],
});

export const getMetricsContentType = (): string => register.contentType;

async function buildPlayerNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const players = await Player.find({}, { name: 1 }).lean().exec();
    for (const p of players) {
      map.set(String(p._id), p.name ?? String(p._id));
    }
  } catch { /* best-effort */ }
  return map;
}

export const refreshBusinessMetrics = async (): Promise<void> => {
  try {
    registeredUsersTotal.set(await User.countDocuments().exec());
  } catch { /* best-effort */ }

  try {
    activeSellPostsGauge.reset();
    const [activeSells, nameMap] = await Promise.all([
      Order.aggregate<{ _id: unknown; count: number }>([
        { $match: { side: 'SELL', status: 'ACTIVE' } },
        { $group: { _id: '$playerId', count: { $sum: 1 } } },
      ]).exec(),
      buildPlayerNameMap(),
    ]);
    for (const s of activeSells) {
      const name = nameMap.get(String(s._id)) ?? String(s._id);
      activeSellPostsGauge.set({ player_name: name }, s.count);
    }
  } catch { /* best-effort */ }

  try {
    holdingsDistribution.reset();
    const [holdings, nameMap] = await Promise.all([
      (async () => {
        const su = await User.findOne({ isSuperuser: true }, { _id: 1 }).lean().exec();
        const matchStage: Record<string, unknown> = {};
        if (su) matchStage.userId = { $ne: su._id };
        return Holding.aggregate<{ _id: unknown; count: number }>([
          { $match: matchStage },
          { $group: { _id: '$playerId', count: { $sum: 1 } } },
        ]).exec();
      })(),
      buildPlayerNameMap(),
    ]);
    for (const h of holdings) {
      const name = nameMap.get(String(h._id)) ?? String(h._id);
      holdingsDistribution.set({ player_name: name }, h.count);
    }
  } catch { /* best-effort */ }
};

export const getMetrics = async (): Promise<string> => {
  await refreshBusinessMetrics();
  return register.metrics();
};

export const healthCheck = async (): Promise<{ status: string; db: string; uptime: number }> => {
  const dbState = mongoose.connection.readyState;
  const dbMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return {
    status: dbState === 1 ? 'ok' : 'degraded',
    db: dbMap[dbState] ?? 'unknown',
    uptime: process.uptime(),
  };
};

export const systemInfo = (): Record<string, unknown> => ({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  memory: {
    free: os.freemem(),
    total: os.totalmem(),
    usage: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(1) + '%',
  },
  cpus: os.cpus().length,
  uptime: process.uptime(),
  env: process.env.NODE_ENV ?? 'development',
});
