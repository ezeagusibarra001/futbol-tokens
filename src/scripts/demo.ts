/* eslint-disable no-console */
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import { seedSuperuser } from '../config/seed';
import { User } from '../modules/auth/user.model';
import { Player, IPlayer } from '../modules/player/player.model';
import { Quote } from '../modules/quote/quote.model';
import { Holding } from '../modules/market/holding.model';
import { Order } from '../modules/market/order.model';
import { recalculateAll } from '../modules/quote/quote.service';
import { ensureInitialHoldingsForAllPlayers } from '../modules/market/market.service';
import { buy } from '../modules/market/order.service';
import { getPortfolio } from '../modules/market/portfolio.service';
import { findQuotesByPlayer } from '../modules/quote/quote.repository';
import { cache } from '../config/cache';

const DEMO_USERS = [
  { email: 'demo1@futbol-tokens.local', password: 'demo1234' },
  { email: 'demo2@futbol-tokens.local', password: 'demo1234' },
  { email: 'demo3@futbol-tokens.local', password: 'demo1234' },
  { email: 'demo4@futbol-tokens.local', password: 'demo1234' },
];

const STARTING_STATS: IPlayer[] = [
  { name: 'Demo Haaland', position: 'FW', league: 'Premier League', team: 'Manchester City', goals: 8, assists: 2, shots: 22, rating: 7.6, keyPasses: 5, dribbles: 4, tackles: 1, minutesPlayed: 720, yellowCards: 1, redCards: 0 },
  { name: 'Demo Kane', position: 'FW', league: 'Bundesliga', team: 'Bayern', goals: 9, assists: 3, shots: 25, rating: 7.7, keyPasses: 7, dribbles: 3, tackles: 1, minutesPlayed: 810, yellowCards: 0, redCards: 0 },
  { name: 'Demo Bellingham', position: 'MF', league: 'La Liga', team: 'Real Madrid', goals: 5, assists: 4, shots: 14, rating: 7.9, keyPasses: 12, dribbles: 8, tackles: 7, minutesPlayed: 780, yellowCards: 2, redCards: 0 },
  { name: 'Demo Lautaro', position: 'FW', league: 'Serie A', team: 'Inter', goals: 7, assists: 2, shots: 20, rating: 7.5, keyPasses: 4, dribbles: 5, tackles: 1, minutesPlayed: 700, yellowCards: 1, redCards: 0 },
  { name: 'Demo Mbappe', position: 'FW', league: 'Ligue 1', team: 'PSG', goals: 10, assists: 4, shots: 28, rating: 8.1, keyPasses: 6, dribbles: 12, tackles: 1, minutesPlayed: 800, yellowCards: 0, redCards: 0 },
];

// "Time passes" — same players, updated stats showing evolution mid-season
const FINAL_STATS = STARTING_STATS.map(p => ({
  ...p,
  goals: p.goals + crypto.randomInt(8) + 2,
  assists: p.assists + crypto.randomInt(4),
  shots: p.shots + crypto.randomInt(15) + 5,
  rating: Math.min(10, p.rating + crypto.randomInt(600_000) / 1_000_000),
  keyPasses: p.keyPasses + crypto.randomInt(8),
  minutesPlayed: p.minutesPlayed + 800,
  yellowCards: p.yellowCards + crypto.randomInt(2),
}));

const upsertPlayers = async (data: IPlayer[]) => {
  const out: { _id: mongoose.Types.ObjectId; name: string; league: string }[] = [];
  for (const p of data) {
    const doc = await Player.findOneAndUpdate(
      { name: p.name, team: p.team, league: p.league },
      { $set: p },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).exec();
    out.push({ _id: doc._id, name: doc.name, league: doc.league });
  }
  return out;
};

const upsertUser = async (email: string, password: string) => {
  let user = await User.findOne({ email }).exec();
  if (!user) {
    const hashed = await bcrypt.hash(password, 10);
    user = await User.create({ email, password: hashed });
  }
  return user;
};

const printSection = (title: string) => {
  console.log('\n' + '═'.repeat(80));
  console.log(`  ${title}`);
  console.log('═'.repeat(80));
};

const fmt = (n: number) => n.toFixed(2).padStart(10);

const run = async () => {
  await connectDB();
  console.log('\n[demo] starting…');

  printSection('1. Limpieza de datos demo previos');
  await Promise.all([
    Player.deleteMany({ name: { $regex: /^Demo / } }),
    User.deleteMany({ email: { $in: DEMO_USERS.map(u => u.email) } }),
  ]);
  // Cleanup holdings and orders for demo users; players in this run will be fresh
  const demoUserIds = (await User.find({ email: { $in: DEMO_USERS.map(u => u.email) } }).exec()).map(u => u._id);
  if (demoUserIds.length) {
    await Holding.deleteMany({ userId: { $in: demoUserIds } });
    await Order.deleteMany({ userId: { $in: demoUserIds } });
  }
  // Clean prior quotes for any leftover Demo player names (defensive)
  await Quote.deleteMany({});
  cache.clear();
  console.log('  ok');

  printSection('2. Superusuario y jugadores demo (1 por liga)');
  await seedSuperuser();
  const players = await upsertPlayers(STARTING_STATS);
  await ensureInitialHoldingsForAllPlayers();
  players.forEach(p => console.log(`  • ${p.league.padEnd(16)} → ${p.name} [${p._id}]`));

  printSection('3. Cotización inicial (kickoff del campeonato)');
  const t0 = await recalculateAll('PerformanceWeighted');
  console.log(`  estrategia: ${t0.strategy} v${t0.version}, quotes creadas: ${t0.quotesCreated}, at: ${t0.at.toISOString()}`);
  const initialQuotes = await Quote.find({}).sort({ at: -1 }).lean().exec();
  for (const q of initialQuotes) {
    const p = players.find(pp => pp._id.toString() === q.playerId.toString());
    console.log(`  • ${p?.name?.padEnd(22)} valor inicial: ${fmt(q.value)}  (score ${q.score.toFixed(4)})`);
  }

  printSection('4. Creación de 4 usuarios y compra inicial');
  const users = await Promise.all(DEMO_USERS.map(u => upsertUser(u.email, u.password)));
  // Each user buys a different mix of the 5 players (tokens count varies)
  const plan: Record<string, Record<string, number>> = {
    [users[0]!.id]: { [players[0]!._id.toString()]: 5, [players[1]!._id.toString()]: 3 },
    [users[1]!.id]: { [players[1]!._id.toString()]: 4, [players[2]!._id.toString()]: 6 },
    [users[2]!.id]: { [players[2]!._id.toString()]: 2, [players[3]!._id.toString()]: 5, [players[4]!._id.toString()]: 3 },
    [users[3]!.id]: { [players[0]!._id.toString()]: 4, [players[3]!._id.toString()]: 4, [players[4]!._id.toString()]: 5 },
  };
  for (const u of users) {
    const buys = plan[u.id]!;
    for (const [pid, tokens] of Object.entries(buys)) {
      const order = await buy(u.id, pid, tokens, `demo-${u.id}-${pid}`);
      const pname = players.find(pp => pp._id.toString() === pid)?.name ?? pid;
      console.log(`  • ${u.email.padEnd(34)} BUY ${String(tokens).padStart(3)} de ${pname.padEnd(22)} @ ${fmt(order.pricePerToken)}  total ${fmt(order.total)}`);
    }
  }

  printSection('5. "Pasa el tiempo" — stats actualizadas + recálculo');
  await upsertPlayers(FINAL_STATS);
  cache.clear();
  const t1 = await recalculateAll('PerformanceWeighted');
  console.log(`  recalc done: ${t1.quotesCreated} quotes, at: ${t1.at.toISOString()}`);

  printSection('6. Evolución de cotizaciones por jugador (kickoff → ahora)');
  for (const p of players) {
    const history = await findQuotesByPlayer(p._id.toString());
    console.log(`\n  ${p.name} (${p.league}):`);
    for (const q of history.reverse()) {
      console.log(`    ${q.at.toISOString()}  valor=${fmt(q.value)}  score=${q.score.toFixed(4)}  via ${q.strategyName} v${q.strategyVersion}`);
    }
  }

  printSection('7. Portfolios de los 4 usuarios');
  for (const u of users) {
    const portfolio = await getPortfolio(u.id);
    console.log(`\n  ${u.email}`);
    console.log(`  ${'jugador'.padEnd(22)} ${'tokens'.padStart(7)} ${'avg'.padStart(10)} ${'precio'.padStart(10)} ${'invertido'.padStart(10)} ${'actual'.padStart(10)} ${'P&L'.padStart(10)}  P&L%`);
    for (const pos of portfolio.positions) {
      console.log(`  ${pos.playerName.padEnd(22)} ${String(pos.tokens).padStart(7)} ${fmt(pos.avgBuyPrice)} ${fmt(pos.currentPrice)} ${fmt(pos.investedValue)} ${fmt(pos.currentValue)} ${fmt(pos.pnl)}  ${pos.pnlPct.toFixed(2)}%`);
    }
    const t = portfolio.totals;
    console.log(`  ${''.padEnd(22)} ${''.padStart(7)} ${''.padStart(10)} ${''.padStart(10)} ${fmt(t.invested)} ${fmt(t.currentValue)} ${fmt(t.pnl)}  ${t.pnlPct.toFixed(2)}%`);
  }

  console.log('\n[demo] done. credenciales: demo1@futbol-tokens.local / demo1234 (etc.)\n');
};

run()
  .catch(err => {
    console.error('[demo] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
