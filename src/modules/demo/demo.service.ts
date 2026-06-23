import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../auth/user.model';
import { Player, IPlayer } from '../player/player.model';
import { Quote } from '../quote/quote.model';
import { Holding } from '../market/holding.model';
import { Order } from '../market/order.model';
import { ensureInitialHoldingsForPlayers } from '../market/market.service';
import { seedSuperuser } from '../../config/seed';
import { cache } from '../../config/cache';

export const DEMO_USERS = [
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

// "Pasa el tiempo": mismas figuras, stats evolucionadas (con algo de azar para que cada corrida sea distinta)
const makeFinalStats = (): IPlayer[] =>
  STARTING_STATS.map(p => ({
    ...p,
    goals: p.goals + crypto.randomInt(8) + 2,
    assists: p.assists + crypto.randomInt(4),
    shots: p.shots + crypto.randomInt(15) + 5,
    rating: Math.min(10, p.rating + crypto.randomInt(600_000) / 1_000_000),
    keyPasses: p.keyPasses + crypto.randomInt(8),
    minutesPlayed: p.minutesPlayed + 800,
    yellowCards: p.yellowCards + crypto.randomInt(2),
  }));

export type DemoPlayer = {
  id: string;
  name: string;
  position: string;
  league: string;
  team: string;
  goals: number;
  assists: number;
  shots: number;
  rating: number;
  keyPasses: number;
  minutesPlayed: number;
};
export type DemoUser = { id: string; email: string; password: string };

const toDemoPlayer = (doc: IPlayer & { _id: Types.ObjectId }): DemoPlayer => ({
  id: doc._id.toString(),
  name: doc.name,
  position: doc.position,
  league: doc.league,
  team: doc.team,
  goals: doc.goals,
  assists: doc.assists,
  shots: doc.shots,
  rating: doc.rating,
  keyPasses: doc.keyPasses,
  minutesPlayed: doc.minutesPlayed,
});

const upsertPlayers = async (data: IPlayer[]): Promise<DemoPlayer[]> => {
  const out: DemoPlayer[] = [];
  for (const p of data) {
    const doc = await Player.findOneAndUpdate(
      { name: p.name, team: p.team, league: p.league },
      { $set: p },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).exec();
    out.push(toDemoPlayer(doc));
  }
  return out;
};

const upsertUser = async (email: string, password: string): Promise<Types.ObjectId> => {
  let user = await User.findOne({ email }).exec();
  if (!user) {
    const hashed = await bcrypt.hash(password, 10);
    user = await User.create({ email, password: hashed });
  }
  return user._id as Types.ObjectId;
};

/**
 * Limpia los datos demo previos, recrea superusuario + 5 jugadores demo (1 por liga)
 * con sus holdings iniciales, y 4 usuarios demo. No crea cotizaciones (eso lo dispara
 * el front contra POST /quotes/recalculate, para "probar la ruta").
 */
export const resetAndSeed = async (): Promise<{ players: DemoPlayer[]; users: DemoUser[] }> => {
  const emails = DEMO_USERS.map(u => u.email);

  // limpiar usuarios demo y todo lo que cuelga de ellos
  const demoUsers = await User.find({ email: { $in: emails } }).select('_id').exec();
  const demoUserIds = demoUsers.map(u => u._id);
  if (demoUserIds.length) {
    await Holding.deleteMany({ userId: { $in: demoUserIds } });
    await Order.deleteMany({ userId: { $in: demoUserIds } });
  }

  // limpiar jugadores demo y sus cotizaciones/holdings
  const oldPlayers = await Player.find({ name: { $regex: /^Demo / } }).select('_id').exec();
  const oldPlayerIds = oldPlayers.map(p => p._id);
  if (oldPlayerIds.length) {
    await Quote.deleteMany({ playerId: { $in: oldPlayerIds } });
    await Holding.deleteMany({ playerId: { $in: oldPlayerIds } });
    await Order.deleteMany({ playerId: { $in: oldPlayerIds } });
  }
  await Player.deleteMany({ name: { $regex: /^Demo / } });
  await User.deleteMany({ email: { $in: emails } });
  cache.clear();

  await seedSuperuser();
  const players = await upsertPlayers(STARTING_STATS);
  await ensureInitialHoldingsForPlayers(players.map(p => new mongoose.Types.ObjectId(p.id)));

  const users: DemoUser[] = [];
  for (const u of DEMO_USERS) {
    const id = await upsertUser(u.email, u.password);
    users.push({ id: id.toString(), email: u.email, password: u.password });
  }

  cache.clear();
  return { players, users };
};

/**
 * "Pasa el tiempo": actualiza las stats de los jugadores demo con su evolución mid-season.
 * No recalcula cotizaciones; el front llama luego a POST /quotes/recalculate.
 */
export const advanceTime = async (): Promise<{ players: DemoPlayer[] }> => {
  const players = await upsertPlayers(makeFinalStats());
  cache.clear();
  return { players };
};
