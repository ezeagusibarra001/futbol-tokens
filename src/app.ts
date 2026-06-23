import './config/init-metrics';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger';
import rootRoutes from './modules/root/root.routes';
import authRoutes from './modules/auth/auth.routes';
import playerRoutes from './modules/player/player.routes';
import quoteRoutes from './modules/quote/quote.routes';
import orderRoutes from './modules/market/order.routes';
import userRoutes, { meRouter } from './modules/user/user.routes';
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

app.use(errorHandler);

export default app;
