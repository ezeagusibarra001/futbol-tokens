import express, { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger';
import rootRoutes from './modules/root/root.routes';
import authRoutes from './modules/auth/auth.routes';
import playerRoutes from './modules/player/player.routes';
import quoteRoutes from './modules/quote/quote.routes';
import orderRoutes from './modules/market/order.routes';
import userRoutes from './modules/user/user.routes';

const app = express();

app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/', rootRoutes);
app.use('/auth', authRoutes);
app.use('/players', playerRoutes);
app.use('/quotes', quoteRoutes);
app.use('/orders', orderRoutes);
app.use('/users', userRoutes);

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;
  res.status(status).json({ message: err.message ?? 'Internal server error' });
});

export default app;
