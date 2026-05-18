import bcrypt from 'bcryptjs';
import { User } from '../modules/auth/user.model';
import { ensureInitialHoldingsForAllPlayers } from '../modules/market/market.service';

export const seedSuperuser = async (): Promise<void> => {
  const email = (process.env.SUPERUSER_EMAIL ?? 'superuser@futbol-tokens.local').toLowerCase();
  const password = process.env.SUPERUSER_PASSWORD ?? 'change-me-now';

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
  console.info(`[seed] superuser created: ${email}`);
};

export const seedAll = async (): Promise<void> => {
  await seedSuperuser();
  const created = await ensureInitialHoldingsForAllPlayers();
  if (created > 0) console.info(`[seed] initial holdings created for ${created} players`);
};
