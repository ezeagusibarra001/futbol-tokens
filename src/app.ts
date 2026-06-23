import './config/init-metrics';
import path from 'path';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger';
import rootRoutes from './modules/root/root.routes';
import authRoutes from './modules/auth/auth.routes';
import playerRoutes from './modules/player/player.routes';
import quoteRoutes from './modules/quote/quote.routes';
import orderRoutes from './modules/market/order.routes';
import userRoutes, { meRouter } from './modules/user/user.routes';
import demoRoutes from './modules/demo/demo.routes';
import monitorRoutes from './modules/monitor/monitor.routes';
import { metricsMiddleware } from './modules/monitor/metrics.middleware';
import { auditMiddleware } from './config/audit.middleware';
import { errorHandler, requestLogger } from './config/error-handler';

const app = express();

app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(auditMiddleware);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/', rootRoutes);
app.use('/auth', authRoutes);
app.use('/players', playerRoutes);
app.use('/quotes', quoteRoutes);
app.use('/orders', orderRoutes);
app.use('/users', userRoutes);
app.use('/me', meRouter);
app.use(monitorRoutes);

// Demo interactiva: front estático + endpoints de apoyo (deshabilitable con DEMO_ENABLED=false)
if (process.env.DEMO_ENABLED !== 'false') {
  const demoPage = path.join(process.cwd(), 'public', 'demo.html');
  app.get('/demo', (_req, res) => res.sendFile(demoPage));
  app.use('/demo', demoRoutes);
}

app.use(errorHandler);

export default app;
