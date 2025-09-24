import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './env';
import { qboRouter } from './routes/qbo';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

app.get('/', (_req, res) => res.status(200).json({ ok: true, service: 'wmxdash-api' }));

// Mount QuickBooks ops (status/refresh for now)
app.use('/api/qbo', qboRouter);

// Demo/placeholder
app.get('/api/employees', (_req, res) => res.json([{ id: 1, name: 'Demo' }]));

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message ?? 'Internal Server Error' });
});

app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
});

