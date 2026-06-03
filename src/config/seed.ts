import bcrypt from 'bcryptjs';
import { User } from '../modules/auth/user.model';
import { Player, IPlayer } from '../modules/player/player.model';
import { Quote } from '../modules/quote/quote.model';
import { ensureInitialHoldingsForAllPlayers } from '../modules/market/market.service';
import { recalculateAll } from '../modules/quote/quote.service';
import { logger } from './logger';

const DEMO_PLAYERS: IPlayer[] = [
  { name: 'Erling Haaland', position: 'FW', league: 'Premier League', team: 'Manchester City', goals: 8, assists: 2, shots: 22, rating: 7.6, keyPasses: 5, dribbles: 4, tackles: 1, minutesPlayed: 720, yellowCards: 1, redCards: 0 },
  { name: 'Harry Kane', position: 'FW', league: 'Bundesliga', team: 'Bayern Munich', goals: 9, assists: 3, shots: 25, rating: 7.7, keyPasses: 7, dribbles: 3, tackles: 1, minutesPlayed: 810, yellowCards: 0, redCards: 0 },
  { name: 'Jude Bellingham', position: 'MF', league: 'La Liga', team: 'Real Madrid', goals: 5, assists: 4, shots: 14, rating: 7.9, keyPasses: 12, dribbles: 8, tackles: 7, minutesPlayed: 780, yellowCards: 2, redCards: 0 },
  { name: 'Lautaro Martinez', position: 'FW', league: 'Serie A', team: 'Inter Milan', goals: 7, assists: 2, shots: 20, rating: 7.5, keyPasses: 4, dribbles: 5, tackles: 1, minutesPlayed: 700, yellowCards: 1, redCards: 0 },
  { name: 'Kylian Mbappe', position: 'FW', league: 'Ligue 1', team: 'PSG', goals: 10, assists: 4, shots: 28, rating: 8.1, keyPasses: 6, dribbles: 12, tackles: 1, minutesPlayed: 800, yellowCards: 0, redCards: 0 },
];

export const seedSuperuser = async (): Promise<void> => {
  const email = (process.env.SUPERUSER_EMAIL ?? 'superuser@futbol-tokens.local').toLowerCase();
  const password = process.env.SUPERUSER_PASSWORD;
  if (!password) throw new Error('SUPERUSER_PASSWORD environment variable is required');

  const existing = await User.findOne({ email }).exec();
  if (existing) {
    if (!existing.isSuperuser) {
      existing.isSuperuser = true;
      await existing.save();
    }
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await User.create({ email, password: hashed, isSuperuser: true });
  logger.info(`[seed] superuser created: ${email}`);
};

export const seedDemoPlayers = async (): Promise<void> => {
  const count = await Player.countDocuments().exec();
  if (count > 0) {
    logger.info('[seed] players already exist, skipping demo players');
    return;
  }
  await Player.insertMany(DEMO_PLAYERS);
  logger.info(`[seed] created ${DEMO_PLAYERS.length} demo players`);
};

export const seedDemoQuotes = async (): Promise<void> => {
  const count = await Quote.countDocuments().exec();
  if (count > 0) {
    logger.info('[seed] quotes already exist, skipping');
    return;
  }
  const result = await recalculateAll();
  logger.info(`[seed] created ${result.quotesCreated} quotes via ${result.strategy} v${result.version}`);
};

export const seedDemoUser = async (): Promise<void> => {
  const email = 'demo@futbol-tokens.local';
  const existing = await User.findOne({ email }).exec();
  if (existing) return;
  const hashed = await bcrypt.hash('demo1234', 10);
  await User.create({ email, password: hashed });
  logger.info(`[seed] demo user created: ${email} / demo1234`);
};

export const seedAll = async (): Promise<void> => {
  await seedSuperuser();
  await seedDemoPlayers();
  const created = await ensureInitialHoldingsForAllPlayers();
  if (created > 0) logger.info(`[seed] initial holdings created for ${created} players`);
  await seedDemoQuotes();
  await seedDemoUser();
};
