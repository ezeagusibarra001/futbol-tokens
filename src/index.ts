import 'dotenv/config';
import app from './app';
import { connectDB } from './config/db';
import { seedAll } from './config/seed';

const PORT = process.env.PORT ?? 3000;

connectDB()
  .then(async () => {
    if (process.env.SEED_ON_BOOT === 'true') {
      await seedAll();
    }
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err: Error) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
