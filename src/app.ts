import express, { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger';
import rootRoutes from './modules/root/root.routes';
import authRoutes from './modules/auth/auth.routes';

const app = express();

app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/', rootRoutes);
app.use('/auth', authRoutes);

// Global error handler
app.use((err: Error & { status?: number }, _req: Request, res: Response) => {
  const status = err.status ?? 500;
  res.status(status).json({ message: err.message ?? 'Internal server error' });
});

export default app;
