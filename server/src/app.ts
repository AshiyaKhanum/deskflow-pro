import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiters';
import { env } from './config/env';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  // Render (and most PaaS hosts) sit behind a reverse proxy, so Express needs to trust
  // the single hop of X-Forwarded-* headers it adds - otherwise express-rate-limit can't
  // safely derive a real client IP and logs a validation warning on every request.
  app.set('trust proxy', 1);
  app.use(helmet());

  const allowedOrigins = env.clientUrl.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  app.use('/api', apiLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
